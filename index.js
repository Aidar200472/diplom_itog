const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");

// Database wrapper class
class Database {
  constructor() {
    this.db = new sqlite3.Database("database.sqlite");
    this.checkTables();
  }

  checkTables() {
    this.db.all(
      "SELECT * FROM sqlite_master WHERE type='table'",
      (err, tables) => {
        if (err) {
          console.error("Error checking tables:", err);
          return;
        }

        // Создаем таблицу пользователей, если её нет
        this.db.run(`
          CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
          )
        `);

        // Создаем таблицу корзины, если её нет
        this.db.run(`
          CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES user(id),
            FOREIGN KEY (product_id) REFERENCES product(id)
          )
        `);

        // Проверяем наличие колонки quantity
        this.db.all("PRAGMA table_info(cart)", (err, rows) => {
          if (err) {
            console.error("Error checking cart table structure:", err);
            return;
          }

          const hasQuantity = rows.some((row) => row.name === "quantity");
          if (!hasQuantity) {
            console.log("Adding quantity column to cart table");
            this.db.run(
              "ALTER TABLE cart ADD COLUMN quantity INTEGER DEFAULT 1"
            );
          }
        });

        // Создаем таблицу заказов, если её нет
        this.db.run(`
          CREATE TABLE IF NOT EXISTS "order" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            delivery TEXT NOT NULL,
            address TEXT,
            payment_method TEXT NOT NULL,
            comment TEXT,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user(id)
          )
        `);

        // Создаем таблицу товаров заказа, если её нет
        this.db.run(`
          CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            price INTEGER NOT NULL,
            FOREIGN KEY (order_id) REFERENCES "order"(id),
            FOREIGN KEY (product_id) REFERENCES product(id)
          )
        `);
      }
    );
  }

  getCategories() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM category", [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  getManufacturers() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM manufacturer", [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  getProducts(categoryId = null, manufacturerId = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT p.*, c.name as category_name, m.name as manufacturer_name 
        FROM product p
        LEFT JOIN category c ON p.category_id = c.id
        LEFT JOIN manufacturer m ON p.manufacturer_id = m.id
        WHERE 1=1
      `;
      const params = [];

      if (categoryId && categoryId !== "all") {
        query += " AND p.category_id = ?";
        params.push(categoryId);
      }

      if (manufacturerId && manufacturerId !== "all") {
        query += " AND p.manufacturer_id = ?";
        params.push(manufacturerId);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM user WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  createUser(user) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO user (full_name, phone, email, password) VALUES (?, ?, ?, ?)",
        [user.full_name, user.phone, user.email, user.password],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Методы для работы с корзиной
  getCartItems(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT c.*, p.name, p.price, p.image 
        FROM cart c
        JOIN product p ON c.product_id = p.id
        WHERE c.user_id = ?
      `,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  addToCart(userId, productId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        INSERT INTO cart (user_id, product_id)
        VALUES (?, ?)
      `,
        [userId, productId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  updateCartItemQuantity(userId, productId, change) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        UPDATE cart 
        SET quantity = quantity + ?
        WHERE user_id = ? AND product_id = ?
      `,
        [change, userId, productId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  removeFromCart(userId, productId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        DELETE FROM cart
        WHERE user_id = ? AND product_id = ?
      `,
        [userId, productId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getCartCount(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT COUNT(*) as count
        FROM cart
        WHERE user_id = ?
      `,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
  }
}

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request body:", req.body);
  }
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

// Serve static files from diplom-main directory
app.use(express.static(path.join(__dirname, "diplom-main")));

// Initialize database
const db = new Database();

// API endpoint for categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await db.getCategories();
    const categoriesHtml = categories
      .map(
        (category) => `
      <li>
        <a href="#" 
           class="category-link" 
           data-category="${category.id}"
           onclick="event.preventDefault(); 
                    const manufacturer = document.querySelector('.manufacturer-link.active');
                    const manufacturerId = manufacturer ? manufacturer.dataset.manufacturer : null;
                    const currentCategory = document.querySelector('.category-link.active');
                    
                    if (currentCategory && currentCategory.dataset.category === '${category.id}') {
                      // Если нажали на активную категорию - снимаем фильтр
                      currentCategory.classList.remove('active');
                      htmx.ajax('GET', '/api/products' + (manufacturerId ? '?manufacturer=' + manufacturerId : ''), '#products-container');
                    } else {
                      // Если нажали на новую категорию - применяем фильтр
                      document.querySelectorAll('.category-link').forEach(link => link.classList.remove('active'));
                      this.classList.add('active');
                      htmx.ajax('GET', '/api/products?category=${category.id}' + (manufacturerId ? '&manufacturer=' + manufacturerId : ''), '#products-container');
                    }"
        >${category.name}</a>
      </li>
    `
      )
      .join("");

    res.send(categoriesHtml);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Error loading categories");
  }
});

// API endpoint for manufacturers
app.get("/api/manufacturers", async (req, res) => {
  try {
    const manufacturers = await db.getManufacturers();
    const manufacturersHtml = manufacturers
      .map(
        (manufacturer) => `
      <li>
        <a href="#" 
           class="manufacturer-link" 
           data-manufacturer="${manufacturer.id}"
           onclick="event.preventDefault(); 
                    const category = document.querySelector('.category-link.active');
                    const categoryId = category ? category.dataset.category : null;
                    const currentManufacturer = document.querySelector('.manufacturer-link.active');
                    
                    if (currentManufacturer && currentManufacturer.dataset.manufacturer === '${manufacturer.id}') {
                      // Если нажали на активного производителя - снимаем фильтр
                      currentManufacturer.classList.remove('active');
                      htmx.ajax('GET', '/api/products' + (categoryId ? '?category=' + categoryId : ''), '#products-container');
                    } else {
                      // Если нажали на нового производителя - применяем фильтр
                      document.querySelectorAll('.manufacturer-link').forEach(link => link.classList.remove('active'));
                      this.classList.add('active');
                      htmx.ajax('GET', '/api/products?manufacturer=${manufacturer.id}' + (categoryId ? '&category=' + categoryId : ''), '#products-container');
                    }"
        >${manufacturer.name}</a>
      </li>
    `
      )
      .join("");

    res.send(manufacturersHtml);
  } catch (error) {
    console.error("Error fetching manufacturers:", error);
    res.status(500).send("Error loading manufacturers");
  }
});

// API endpoint for products
app.get("/api/products", async (req, res) => {
  try {
    const categoryId = req.query.category;
    const manufacturerId = req.query.manufacturer;

    const products = await db.getProducts(categoryId, manufacturerId);

    if (products.length === 0) {
      return res.send(`
        <div class="no-products">
          <i class="fas fa-box-open"></i>
          <p>Товары не найдены</p>
          <p>Попробуйте изменить параметры фильтрации</p>
        </div>
      `);
    }

    const html = products
      .map(
        (product) => `
        <div class="product-card">
          <div class="product-image">
            <img src="${product.image || ""}" alt="${product.name || ""}" />
          </div>
          <div class="product-info">
            <h3 class="product-title">${product.name || ""}</h3>
            <p class="product-brand">${product.manufacturer_name || ""}</p>
            <p class="product-price">${(
              product.price || 0
            ).toLocaleString()} ₽</p>
            <div class="product-actions">
              <button 
                class="details-btn"
                hx-get="/api/products/${product.id}"
                hx-target="#modal-product-details"
                hx-indicator="#loading"
                hx-trigger="click"
                onclick="document.getElementById('product-modal').style.display='block'"
              >
                Подробнее
              </button>
              <button 
                class="add-to-cart-btn"
                onclick="addToCart({
                  id: ${product.id},
                  title: '${(product.name || "").replace(/'/g, "\\'")}',
                  price: ${product.price || 0},
                  image: '${product.image || ""}'
                })"
              >
                В корзину
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join("");
    res.send(html);
  } catch (error) {
    console.error("Error in /api/products:", error);
    res.status(500).send("Error loading products");
  }
});

// Обновляем эндпоинты корзины
app.get("/api/cart", async (req, res) => {
  const userId = req.cookies.userId;
  console.log("GET CART REQUEST:", { userId, cookies: req.cookies });

  if (!userId) {
    console.log("NO USER ID IN COOKIES");
    return res
      .status(401)
      .json({ success: false, message: "Необходима авторизация" });
  }

  try {
    const items = await db.getCartItems(userId);
    console.log("CART ITEMS:", items);
    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      items,
      total,
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при получении корзины" });
  }
});

app.post("/api/cart/add", async (req, res) => {
  const userId = req.cookies.userId;
  console.log("ADD TO CART REQUEST:", {
    userId,
    cookies: req.cookies,
    body: req.body,
  });

  if (!userId) {
    console.log("NO USER ID IN COOKIES");
    return res
      .status(401)
      .json({ success: false, message: "Необходима авторизация" });
  }

  try {
    const { productId } = req.body;
    console.log("ADDING TO CART:", { userId, productId });
    await db.addToCart(userId, productId);
    console.log("SUCCESSFULLY ADDED TO CART");
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при добавлении в корзину" });
  }
});

app.post("/api/cart/update", async (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Необходима авторизация" });
  }

  try {
    const { product_id, quantity } = req.body;
    console.log("Updating cart item:", { userId, product_id, quantity });

    // Обновляем количество товара в корзине
    await new Promise((resolve, reject) => {
      db.db.run(
        `UPDATE cart 
         SET quantity = ? 
         WHERE user_id = ? AND product_id = ?`,
        [quantity, userId, product_id],
        function (err) {
          if (err) {
            console.error("Error updating cart:", err);
            reject(err);
          } else {
            console.log("Cart updated successfully:", this.changes);
            resolve(this.changes);
          }
        }
      );
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating cart:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при обновлении корзины" });
  }
});

app.delete("/api/cart/remove/:id", async (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Необходима авторизация" });
  }

  try {
    const productId = req.params.id;
    await db.removeFromCart(userId, productId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при удалении из корзины" });
  }
});

app.get("/api/cart/count", async (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Необходима авторизация" });
  }

  try {
    const count = await db.getCartCount(userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error("Error getting cart count:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка при получении количества товаров",
    });
  }
});

// Добавляем эндпоинт для получения деталей товара
app.get("/api/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await new Promise((resolve, reject) => {
      db.db.get(
        `
        SELECT p.*, c.name as category_name, m.name as manufacturer_name 
        FROM product p
        LEFT JOIN category c ON p.category_id = c.id
        LEFT JOIN manufacturer m ON p.manufacturer_id = m.id
        WHERE p.id = ?
        `,
        [productId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const html = `
      <div class="modal-product-image">
        <img src="${product.image || ""}" alt="${product.name || ""}">
      </div>
      <div class="modal-product-info">
        <h3 class="modal-product-title">${product.name || ""}</h3>
        <p class="modal-product-brand">${product.manufacturer_name || ""}</p>
        <p class="modal-product-price">${(
          product.price || 0
        ).toLocaleString()} ₽</p>
        <div class="modal-product-description">
          <p>${product.info || "Описание товара отсутствует"}</p>
        </div>
        <div class="modal-product-specs">
          <h4>Характеристики</h4>
          ${(() => {
            try {
              const specs = JSON.parse(product.characteristic || "{}");
              return Object.entries(specs)
                .map(
                  ([key, value]) => `
                  <div class="spec-item">
                    <span class="spec-name">${key}:</span>
                    <span class="spec-value">${value}</span>
                  </div>
                `
                )
                .join("");
            } catch (e) {
              console.error("Error parsing characteristics:", e);
              return "<p>Ошибка при загрузке характеристик</p>";
            }
          })()}
        </div>
        <div class="modal-product-actions">
          <button class="add-to-cart-btn" onclick="addToCart({
            id: ${product.id},
            title: '${(product.name || "").replace(/'/g, "\\'")}',
            price: ${product.price || 0},
            image: '${product.image || ""}'
          })">
            В корзину
          </button>
        </div>
      </div>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).send("Error loading product details");
  }
});

// API endpoint for login
app.post("/api/login", async (req, res) => {
  console.log("LOGIN REQUEST:", req.body);

  try {
    const { phone, password } = req.body;

    // Проверяем, что все необходимые поля заполнены
    if (!phone || !password) {
      console.log("MISSING FIELDS:", { phone: !!phone, password: !!password });
      return res.status(400).json({
        success: false,
        message: "Все поля должны быть заполнены",
      });
    }

    // Форматируем номер телефона
    const formattedPhone = phone.replace(/\D/g, "");
    console.log("FORMATTED PHONE:", formattedPhone);

    // Ищем пользователя по телефону
    const user = await new Promise((resolve, reject) => {
      db.db.get(
        "SELECT * FROM user WHERE phone = ?",
        [formattedPhone],
        (err, row) => {
          if (err) {
            console.log("DATABASE ERROR:", err);
            reject(err);
          } else {
            console.log("FOUND USER:", row);
            resolve(row);
          }
        }
      );
    });

    if (!user) {
      console.log("USER NOT FOUND");
      return res.status(400).json({
        success: false,
        message: "Неверный номер телефона или пароль",
      });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    console.log("PASSWORD CHECK:", { valid: validPassword });

    if (!validPassword) {
      console.log("INVALID PASSWORD");
      return res.status(400).json({
        success: false,
        message: "Неверный номер телефона или пароль",
      });
    }

    console.log("LOGIN SUCCESS:", { userId: user.id });

    // Устанавливаем куку с userId
    res.cookie("userId", user.id, {
      httpOnly: false, // Изменено на false, чтобы кука была доступна в JavaScript
      secure: false, // Изменено на false для локальной разработки
      sameSite: "lax", // Добавлено для лучшей совместимости
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      path: "/",
    });

    // Проверяем, что кука установилась
    console.log("SET COOKIE:", { userId: user.id });

    res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
      },
      message: "Вход выполнен успешно",
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при входе",
    });
  }
});

// API endpoint for registration
app.post("/api/register", async (req, res) => {
  console.log("REGISTRATION:", req.body);

  try {
    const { full_name, phone, email, password } = req.body;

    // Проверяем, что все необходимые поля заполнены
    if (!full_name || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Все поля должны быть заполнены",
      });
    }

    // Проверяем, что email не занят
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Пользователь с таким email уже существует",
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const userId = await db.createUser({
      full_name,
      phone,
      email,
      password: hashedPassword,
    });

    // Генерируем токен
    const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64");

    console.log("REGISTRATION SUCCESS:", userId);

    res.json({
      success: true,
      token,
      message: "Регистрация успешна",
    });
  } catch (error) {
    console.log("REGISTRATION ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при регистрации",
    });
  }
});

// API endpoint для получения данных пользователя
app.get("/api/user", async (req, res) => {
  console.log("GET USER REQUEST:", { cookies: req.cookies });

  try {
    const userId = req.cookies.userId;

    if (!userId) {
      console.log("NO USER ID IN COOKIES");
      return res.status(401).json({
        success: false,
        message: "Пользователь не авторизован",
      });
    }

    // Получаем данные пользователя из базы данных
    const user = await new Promise((resolve, reject) => {
      db.db.get(
        "SELECT id, full_name, email, phone FROM user WHERE id = ?",
        [userId],
        (err, row) => {
          if (err) {
            console.log("DATABASE ERROR:", err);
            reject(err);
          } else {
            console.log("FOUND USER:", row);
            resolve(row);
          }
        }
      );
    });

    if (!user) {
      console.log("USER NOT FOUND");
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    console.log("RETURNING USER DATA:", user);
    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.log("GET USER ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при получении данных пользователя",
    });
  }
});

// API endpoint для выхода
app.post("/api/logout", (req, res) => {
  console.log("LOGOUT REQUEST");
  res.clearCookie("userId", { path: "/" });
  res.json({ success: true, message: "Выход выполнен успешно" });
});

// API endpoint для получения истории заказов
app.get("/api/orders", async (req, res) => {
  console.log("GET ORDERS REQUEST:", { cookies: req.cookies });

  try {
    const userId = req.cookies.userId;

    if (!userId) {
      console.log("NO USER ID IN COOKIES");
      return res.status(401).json({
        success: false,
        message: "Пользователь не авторизован",
      });
    }

    // Получаем заказы пользователя из базы данных
    const orders = await new Promise((resolve, reject) => {
      db.db.all(
        `SELECT o.*, 
         GROUP_CONCAT(p.name || ' - ' || oi.price || ' ₽') as items,
         SUM(oi.price) as total
         FROM "order" o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN product p ON oi.product_id = p.id
         WHERE o.user_id = ?
         GROUP BY o.id
         ORDER BY o.id DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.log("DATABASE ERROR:", err);
            reject(err);
          } else {
            console.log("FOUND ORDERS:", rows);
            resolve(rows);
          }
        }
      );
    });

    console.log("RETURNING ORDERS:", orders);
    res.json({
      success: true,
      orders: orders,
    });
  } catch (error) {
    console.log("GET ORDERS ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при получении истории заказов",
    });
  }
});

// API endpoint для создания заказа
app.post("/api/orders", async (req, res) => {
  console.log("CREATE ORDER REQUEST:", {
    cookies: req.cookies,
    body: req.body,
  });

  try {
    const userId = req.cookies.userId;

    if (!userId) {
      console.log("NO USER ID IN COOKIES");
      return res.status(401).json({
        success: false,
        message: "Пользователь не авторизован",
      });
    }

    const {
      full_name,
      phone,
      email,
      delivery,
      address,
      payment_method,
      comment,
    } = req.body;

    // Проверяем наличие всех необходимых полей
    if (!full_name || !phone || !email || !delivery || !payment_method) {
      return res.status(400).json({
        success: false,
        message: "Не все обязательные поля заполнены",
      });
    }

    // Проверяем адрес при доставке
    if (delivery === "delivery" && !address) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать адрес доставки",
      });
    }

    // Получаем товары из корзины
    const cartItems = await db.getCartItems(userId);
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Корзина пуста",
      });
    }

    // Создаем заказ
    const orderId = await new Promise((resolve, reject) => {
      db.db.run(
        `INSERT INTO "order" (
          user_id,
          full_name,
          phone,
          email,
          delivery,
          address,
          payment_method,
          comment,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`,
        [
          userId,
          full_name,
          phone,
          email,
          delivery,
          address,
          payment_method,
          comment,
        ],
        function (err) {
          if (err) {
            console.log("DATABASE ERROR:", err);
            reject(err);
          } else {
            console.log("ORDER CREATED:", this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });

    // Добавляем товары в заказ
    for (const item of cartItems) {
      await new Promise((resolve, reject) => {
        db.db.run(
          `INSERT INTO order_items (order_id, product_id, price)
           VALUES (?, ?, ?)`,
          [orderId, item.product_id, item.price],
          function (err) {
            if (err) {
              console.log("DATABASE ERROR:", err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }

    // Очищаем корзину
    await new Promise((resolve, reject) => {
      db.db.run("DELETE FROM cart WHERE user_id = ?", [userId], function (err) {
        if (err) {
          console.log("DATABASE ERROR:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log("ORDER CREATED SUCCESSFULLY:", orderId);
    res.json({
      success: true,
      orderId: orderId,
      message: "Заказ успешно создан",
    });
  } catch (error) {
    console.log("CREATE ORDER ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при создании заказа",
    });
  }
});

// API endpoint для очистки корзины
app.post("/api/cart/clear", async (req, res) => {
  console.log("CLEAR CART REQUEST:", { cookies: req.cookies });

  try {
    const userId = req.cookies.userId;

    if (!userId) {
      console.log("NO USER ID IN COOKIES");
      return res.status(401).json({
        success: false,
        message: "Пользователь не авторизован",
      });
    }

    await new Promise((resolve, reject) => {
      db.db.run("DELETE FROM cart WHERE user_id = ?", [userId], function (err) {
        if (err) {
          console.log("DATABASE ERROR:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log("CART CLEARED SUCCESSFULLY");
    res.json({
      success: true,
      message: "Корзина очищена",
    });
  } catch (error) {
    console.log("CLEAR CART ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Ошибка при очистке корзины",
    });
  }
});

// Routes for HTML files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "diplom-main", "index.html"));
});

// Add logging middleware
app.use((req, res, next) => {
  next();
});

// Start server
app.listen(port, () => {});
