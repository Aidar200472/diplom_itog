// Обновление количества товара в корзине
app.post("/api/cart/update", (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.json({ success: false, message: "Необходима авторизация" });
  }

  const { productId, change } = req.body;
  if (!productId || change === undefined) {
    return res.json({
      success: false,
      message: "Необходимо указать ID товара и изменение количества",
    });
  }

  // Получаем текущее количество товара
  db.get(
    "SELECT quantity FROM cart WHERE user_id = ? AND product_id = ?",
    [userId, productId],
    (err, row) => {
      if (err) {
        console.error("Error getting cart item:", err);
        return res.json({
          success: false,
          message: "Ошибка при получении данных корзины",
        });
      }

      if (!row) {
        return res.json({
          success: false,
          message: "Товар не найден в корзине",
        });
      }

      const newQuantity = row.quantity + change;

      // Если новое количество меньше 1, удаляем товар
      if (newQuantity < 1) {
        db.run(
          "DELETE FROM cart WHERE user_id = ? AND product_id = ?",
          [userId, productId],
          (err) => {
            if (err) {
              console.error("Error removing item from cart:", err);
              return res.json({
                success: false,
                message: "Ошибка при удалении товара из корзины",
              });
            }
            res.json({ success: true, quantity: 0 });
          }
        );
      } else {
        // Иначе обновляем количество
        db.run(
          "UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?",
          [newQuantity, userId, productId],
          (err) => {
            if (err) {
              console.error("Error updating cart:", err);
              return res.json({
                success: false,
                message: "Ошибка при обновлении корзины",
              });
            }
            res.json({ success: true, quantity: newQuantity });
          }
        );
      }
    }
  );
});

// Создание заказа
app.post("/api/orders", (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.json({ success: false, message: "Необходима авторизация" });
  }

  // Создаем заказ
  const orderData = {
    full_name: req.body.full_name,
    phone: req.body.phone,
    email: req.body.email,
    delivery: req.body.delivery,
    address: req.body.address,
    payment_method: req.body.payment_method,
    comment: req.body.comment,
    user_id: userId,
    status: "new", // Добавляем статус "new" для новых заказов
  };

  // Проверяем обязательные поля
  if (
    !orderData.full_name ||
    !orderData.phone ||
    !orderData.email ||
    !orderData.delivery ||
    !orderData.payment_method
  ) {
    return res.json({
      success: false,
      message: "Заполните все обязательные поля",
    });
  }

  // Проверяем адрес при выборе доставки
  if (orderData.delivery === "delivery" && !orderData.address) {
    return res.json({ success: false, message: "Укажите адрес доставки" });
  }

  // Получаем товары из корзины
  db.all("SELECT * FROM cart WHERE user_id = ?", [userId], (err, cartItems) => {
    if (err) {
      console.error("Error getting cart items:", err);
      return res.json({
        success: false,
        message: "Ошибка при получении данных корзины",
      });
    }

    if (cartItems.length === 0) {
      return res.json({ success: false, message: "Корзина пуста" });
    }

    // Создаем заказ
    db.run(
      `INSERT INTO "order" (full_name, phone, email, delivery, address, payment_method, comment, user_id, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        orderData.full_name,
        orderData.phone,
        orderData.email,
        orderData.delivery,
        orderData.address,
        orderData.payment_method,
        orderData.comment,
        orderData.user_id,
        orderData.status,
      ],    
      function (err) {
        if (err) {
          console.error("Error creating order:", err);
          return res.json({
            success: false,
            message: "Ошибка при создании заказа",
          });
        }

        const orderId = this.lastID;

        // Добавляем товары в заказ
        const stmt = db.prepare(
          "INSERT INTO order_items (order_id, product_id, price) VALUES (?, ?, ?)"
        );
        cartItems.forEach((item) => {
          stmt.run(orderId, item.product_id, item.price);
        });
        stmt.finalize();

        // Очищаем корзину
        db.run("DELETE FROM cart WHERE user_id = ?", [userId], (err) => {
          if (err) {
            console.error("Error clearing cart:", err);
          }
          res.json({ success: true, orderId });
        });
      }
    );
  });
});
