// Функция для получения userId из куки
function getUserIdFromCookie() {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "userId") {
      return value;
    }
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM Content Loaded - Initializing cart elements");

  // Инициализация элементов корзины
  const cartModal = document.getElementById("cart-modal");
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");
  const cartItemsCount = document.getElementById("cart-items-count");
  const checkoutBtn = document.getElementById("checkout-btn");
  const cartIcon = document.querySelector(".cart-icon");

  console.log("Cart elements initialization:", {
    cartModal: cartModal ? "found" : "not found",
    cartItems: cartItems ? "found" : "not found",
    cartTotal: cartTotal ? "found" : "not found",
    cartItemsCount: cartItemsCount ? "found" : "not found",
    checkoutBtn: checkoutBtn ? "found" : "not found",
    cartIcon: cartIcon ? "found" : "not found",
  });

  // Добавляем обработчик кликов на весь контейнер корзины
  if (cartItems) {
    cartItems.addEventListener("click", async function (e) {
      const target = e.target;

      // Обработка кнопки удаления
      if (
        target.classList.contains("remove-item") ||
        target.closest(".remove-item")
      ) {
        const cartItem = target.closest(".cart-item");
        const productId = cartItem.dataset.productId;

        console.log("Remove button clicked:", productId);

        try {
          const response = await fetch(`/api/cart/remove/${productId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to remove item");
          }

          console.log("Item removed successfully");
          await updateCartContent();
        } catch (error) {
          console.error("Error removing item:", error);
          showNotification("Ошибка при удалении товара", "error");
        }
      }
    });
  }

  // Начинаем наблюдение за изменениями в корзине
  if (cartItems) {
    console.log("Started observing cart changes");
  }

  // Обработчик для кнопки корзины в навигации
  if (cartIcon) {
    cartIcon.addEventListener("click", () => {
      console.log("Cart icon clicked");
      if (cartModal) {
        console.log("Cart modal found, displaying...");
        cartModal.style.display = "block";
        console.log("Calling updateCartContent...");
        updateCartContent();
      } else {
        console.error("Cart modal not found in DOM");
      }
    });
  }

  // Инициализация обработчиков событий
  function initEventListeners() {
    const loginModal = document.getElementById("login-modal");
    const registerModal = document.getElementById("register-modal");
    const showRegisterBtn = document.getElementById("show-register");
    const showLoginBtn = document.getElementById("show-login");
    const loginLink = document.getElementById("login-link");

    // Форматирование номера карты
    const cardNumber = document.getElementById("card-number");
    if (cardNumber) {
      cardNumber.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 16) value = value.slice(0, 16);
        value = value.replace(/(\d{4})/g, "$1 ").trim();
        e.target.value = value;
      });

      cardNumber.addEventListener("keypress", (e) => {
        if (!/\d/.test(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Форматирование срока действия карты
    const cardExpiry = document.getElementById("card-expiry");
    if (cardExpiry) {
      cardExpiry.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");

        if (value.length >= 2) {
          const month = parseInt(value.slice(0, 2));
          if (month > 12) value = "12" + value.slice(2);
          if (month === 0) value = "01" + value.slice(2);
        }

        if (value.length >= 2) {
          value = value.slice(0, 2) + "/" + value.slice(2, 4);
        }
        e.target.value = value;
      });

      cardExpiry.addEventListener("keypress", (e) => {
        if (!/\d/.test(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Валидация CVV
    const cardCvv = document.getElementById("card-cvv");
    if (cardCvv) {
      cardCvv.addEventListener("keypress", (e) => {
        if (!/\d/.test(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Обработчик для кнопки входа в навигации
    if (loginLink) {
      loginLink.addEventListener("click", function (e) {
        e.preventDefault();
        if (loginModal) {
          loginModal.style.display = "block";
        }
      });
    }

    // Обработчик отправки формы входа
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      const phoneInput = document.getElementById("login-phone");
      const passwordInput = document.getElementById("login-password");

      if (phoneInput && passwordInput) {
        loginForm.addEventListener("submit", function (e) {
          e.preventDefault();
          console.log("LOGIN FORM SUBMIT");

          const formData = {
            phone: phoneInput.value.replace(/\D/g, ""),
            password: passwordInput.value,
          };
          console.log("LOGIN FORM DATA:", formData);

          fetch("/api/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          })
            .then((response) => {
              console.log("LOGIN RESPONSE STATUS:", response.status);
              return response.json();
            })
            .then((data) => {
              console.log("LOGIN RESPONSE DATA:", data);
              if (data.success) {
                showNotification("Вход выполнен успешно!");
                document.getElementById("login-modal").style.display = "none";
                console.log("UPDATING UI AFTER LOGIN");
                updateCartCount();
                updateUIAfterLogin(data.user);
              } else {
                showNotification(data.message || "Ошибка при входе", "error");
              }
            })
            .catch((error) => {
              console.error("LOGIN ERROR:", error);
              showNotification("Ошибка при входе", "error");
            });
        });
      }
    }

    // Обработчик отправки формы регистрации
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
      const fullNameInput = document.getElementById("register-name");
      const phoneInput = document.getElementById("register-phone");
      const emailInput = document.getElementById("register-email");
      const passwordInput = document.getElementById("register-password");
      const passwordConfirmationInput = document.getElementById(
        "register-password-confirm"
      );

      if (
        fullNameInput &&
        phoneInput &&
        emailInput &&
        passwordInput &&
        passwordConfirmationInput
      ) {
        registerForm.addEventListener("submit", function (e) {
          e.preventDefault();

          const formData = {
            full_name: fullNameInput.value,
            phone: phoneInput.value.replace(/\D/g, ""),
            email: emailInput.value,
            password: passwordInput.value,
            password_confirmation: passwordConfirmationInput.value,
          };

          if (formData.password !== formData.password_confirmation) {
            showNotification("Пароли не совпадают", "error");
            return;
          }

          fetch("/api/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                // Устанавливаем куку с токеном
                document.cookie = `token=${data.token}; path=/; max-age=2592000`; // 30 дней
                showNotification("Регистрация успешна!");
                document.getElementById("register-modal").style.display =
                  "none";

                // Автоматически входим в систему
                fetch("/api/login", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    phone: formData.phone,
                    password: formData.password,
                  }),
                })
                  .then((response) => response.json())
                  .then((loginData) => {
                    if (loginData.success) {
                      showNotification("Вход выполнен успешно!");
                      updateCartCount();
                      updateUIAfterLogin(loginData.user);
                    } else {
                      showNotification(
                        loginData.message || "Ошибка при входе",
                        "error"
                      );
                    }
                  })
                  .catch((error) => {
                    console.error("LOGIN ERROR:", error);
                    showNotification("Ошибка при входе", "error");
                  });
              } else {
                showNotification(
                  data.message || "Ошибка при регистрации",
                  "error"
                );
              }
            })
            .catch((error) => {
              console.error("Registration error:", error);
              showNotification("Ошибка при регистрации", "error");
            });
        });
      }
    }

    // Закрытие модальных окон по крестику
    document.querySelectorAll(".close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", function () {
        const modal = this.closest(".modal");
        if (modal) modal.style.display = "none";
      });
    });

    // Закрытие модальных окон по клику вне окна
    window.addEventListener("click", function (event) {
      if (event.target.classList.contains("modal")) {
        event.target.style.display = "none";
      }
    });

    // Обработчик для кнопки оформления заказа
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function () {
        // Проверяем авторизацию
        const userId = getUserIdFromCookie();
        if (!userId) {
          showNotification(
            "Для оформления заказа необходимо войти в систему",
            "error"
          );
          return;
        }

        // Проверяем наличие товаров в корзине
        fetch("/api/cart")
          .then((response) => response.json())
          .then((data) => {
            if (data.success && data.items.length > 0) {
              // Закрываем модальное окно корзины
              document.getElementById("cart-modal").style.display = "none";
              // Показываем модальное окно оформления заказа
              showCheckoutModal();
            } else {
              showNotification("Корзина пуста", "error");
            }
          })
          .catch((error) => {
            console.error("Error checking cart:", error);
            showNotification("Ошибка при проверке корзины", "error");
          });
      });
    }

    // Обработчики для переключения между модальными окнами авторизации
    if (showRegisterBtn && loginModal && registerModal) {
      showRegisterBtn.addEventListener("click", () => {
        loginModal.style.display = "none";
        registerModal.style.display = "block";
      });
    }

    if (showLoginBtn && loginModal && registerModal) {
      showLoginBtn.addEventListener("click", () => {
        registerModal.style.display = "none";
        loginModal.style.display = "block";
      });
    }
  }

  // Функция для проверки авторизации и обновления UI
  async function checkAuthAndUpdateUI() {
    const userId = getUserIdFromCookie();
    console.log("CHECKING AUTH:", { userId });

    if (userId) {
      try {
        const response = await fetch("/api/user");
        const data = await response.json();
        console.log("USER DATA:", data);

        if (data.success) {
          updateUIAfterLogin(data.user);
        } else {
          console.log("AUTH CHECK FAILED:", data.message);
        }
      } catch (error) {
        console.error("AUTH CHECK ERROR:", error);
      }
    }
  }

  // Проверяем авторизацию при загрузке страницы
  checkAuthAndUpdateUI();

  // Инициализация обработчиков при загрузке страницы
  initEventListeners();
  updateCartCount(); // Обновляем счетчик при загрузке страницы

  // Обработчики для способа оплаты
  const paymentInputs = document.querySelectorAll('input[name="payment"]');
  const cardFields = document.getElementById("card-payment-fields");
  const walletFields = document.getElementById("wallet-payment-fields");

  // Показываем поля карты при загрузке, так как карта выбрана по умолчанию
  if (cardFields) {
    cardFields.style.display = "block";
  }

  paymentInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.value === "card" && cardFields) {
        cardFields.style.display = "block";
        if (walletFields) walletFields.style.display = "none";
      } else if (input.value === "wallet" && walletFields) {
        if (cardFields) cardFields.style.display = "none";
        walletFields.style.display = "block";
      } else {
        if (cardFields) cardFields.style.display = "none";
        if (walletFields) walletFields.style.display = "none";
      }
    });
  });
});

// Стили для уведомлений
const style = document.createElement("style");
style.textContent = `
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #2ecc71;
  color: white;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.3s ease;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 300px;
}

.notification.show {
  opacity: 1;
  transform: translateX(0);
}

.notification i {
  font-size: 16px;
}
`;
document.head.appendChild(style);

// Создание элемента уведомления
const notification = document.createElement("div");
notification.className = "notification";
notification.innerHTML =
  '<i class="fas fa-check-circle"></i> Товар успешно добавлен в корзину!';
document.body.appendChild(notification);

// Функция для показа уведомлений
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${
      type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
    }"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);

  // Показываем уведомление
  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  // Удаляем уведомление через 3 секунды
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Функция для добавления товара в корзину
function addToCart(product) {
  console.log("ADD TO CART:", product);
  const userId = getUserIdFromCookie();
  console.log("USER ID FROM COOKIE:", userId);

  if (!userId) {
    showNotification(
      "Для добавления товаров в корзину необходимо авторизоваться",
      "error"
    );
    const loginModal = document.getElementById("login-modal");
    if (loginModal) {
      loginModal.style.display = "block";
    }
    return;
  }

  fetch("/api/cart/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId: product.id }),
  })
    .then((response) => {
      console.log("ADD TO CART RESPONSE STATUS:", response.status);
      return response.json();
    })
    .then((data) => {
      console.log("ADD TO CART RESPONSE:", data);
      if (data.success) {
        showNotification("Товар успешно добавлен в корзину!");
        updateCartCount();
        updateCartContent();
      } else {
        showNotification(
          data.message || "Ошибка при добавлении товара",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("ADD TO CART ERROR:", error);
      showNotification("Ошибка при добавлении товара", "error");
    });
}

// Функция для удаления товара из корзины
function removeFromCart(productId) {
  const userId = getUserIdFromCookie();
  if (!userId) return;

  fetch(`/api/cart/remove/${productId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateCartCount();
        updateCartContent();
        showNotification("Товар удален из корзины");
      } else {
        showNotification(data.message || "Ошибка при удалении товара", "error");
      }
    })
    .catch((error) => {
      showNotification("Ошибка при удалении товара", "error");
    });
}

// Функция для обновления корзины
async function updateCartContent() {
  console.log("Starting updateCartContent");
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");
  const cartItemsCount = document.getElementById("cart-items-count");
  const checkoutBtn = document.getElementById("checkout-btn");

  try {
    const response = await fetch("/api/cart");
    const data = await response.json();
    console.log("Cart data:", data);

    if (data.items && data.items.length > 0) {
      cartItems.innerHTML = data.items
        .map(
          (item) => `
        <div class="cart-item" data-product-id="${item.product_id}">
          <div class="cart-item-image">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img" />
          </div>
          <div class="cart-item-info">
            <h4 class="cart-item-name">${item.name}</h4>
            <p class="cart-item-price">${item.price.toLocaleString()} ₽</p>
          </div>
          <div class="cart-item-quantity">
            <button class="quantity-btn" data-action="decrease">-</button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn" data-action="increase">+</button>
          </div>
          <div class="cart-item-total">${(
            item.price * item.quantity
          ).toLocaleString()} ₽</div>
          <button class="remove-item">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `
        )
        .join("");

      // Добавляем обработчики для кнопок количества
      cartItems.querySelectorAll(".quantity-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const cartItem = e.target.closest(".cart-item");
          const productId = cartItem.dataset.productId;
          const action = e.target.dataset.action;
          const quantityElement = cartItem.querySelector(".quantity-value");
          const currentQuantity = parseInt(quantityElement.textContent);
          const newQuantity =
            action === "increase" ? currentQuantity + 1 : currentQuantity - 1;

          if (newQuantity < 1) return;

          try {
            const response = await fetch("/api/cart/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                product_id: productId,
                quantity: newQuantity,
              }),
            });

            if (!response.ok) throw new Error("Failed to update quantity");

            // Обновляем всю корзину через updateCartContent
            await updateCartContent();
          } catch (error) {
            console.error("Error updating quantity:", error);
            showNotification("Ошибка при обновлении количества", "error");
          }
        });
      });

      cartTotal.textContent = `${data.total.toLocaleString()} ₽`;
      cartItemsCount.textContent = data.items.length;
      checkoutBtn.style.display = "block";
    } else {
      cartItems.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>Ваша корзина пуста</p>
        </div>
      `;
      cartTotal.textContent = "0 ₽";
      cartItemsCount.textContent = "0";
      checkoutBtn.style.display = "none";
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    showNotification("Ошибка при обновлении корзины", "error");
  }
}

// Простая функция для удаления товара
async function removeItem(productId) {
  console.log("Removing item:", productId);

  try {
    const response = await fetch(`/api/cart/remove/${productId}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to remove item");

    await updateCartContent();
  } catch (error) {
    console.error("Error:", error);
    showNotification("Ошибка при удалении товара", "error");
  }
}

// Функция для обновления количества товаров в корзине
function updateCartCount() {
  const userId = getUserIdFromCookie();
  if (!userId) return;

  fetch("/api/cart/count")
    .then((response) => response.json())
    .then((data) => {
      const cartCount = document.querySelector(".cart-count");
      if (cartCount) {
        cartCount.textContent = data.count;
      }
    })
    .catch((error) => {
      console.error("Error getting cart count:", error);
    });
}

// Функция для отображения формы входа
function showLoginForm() {
  const loginModal = document.getElementById("login-modal");
  if (loginModal) loginModal.style.display = "block";
}

// Функция для отображения формы регистрации
function showRegisterForm() {
  const registerModal = document.getElementById("register-modal");
  if (registerModal) registerModal.style.display = "block";
}

// Функция для показа/скрытия пароля
function formatPhoneNumber(input) {
  // Приводим к начальному формату "+7 ("
  if (!input.value.startsWith("+7 (")) {
    input.value = "+7 (";
  }

  let value = input.value.replace(/\D/g, "").replace(/^7/, "");
  value = value.substring(0, 10);

  let formatted = "+7 (";
  if (value.length > 0) {
    formatted += value.substring(0, 3);
    if (value.length > 3) {
      formatted += `) ${value.substring(3, 6)}`;
      if (value.length > 6) {
        formatted += `-${value.substring(6, 8)}`;
        if (value.length > 8) {
          formatted += `-${value.substring(8, 10)}`;
        }
      }
    }
  }

  input.value = formatted;
  return input;
}

document.querySelectorAll('input[type="tel"]').forEach((input) => {
  input.value = "+7 (";

  input.addEventListener("input", function (e) {
    const cursorPos = this.selectionStart;
    formatPhoneNumber(this);

    // Фиксируем курсор если пытаются удалить "+7 ("
    if (cursorPos < 4) {
      this.setSelectionRange(4, 4);
    }
  });

  input.addEventListener("keypress", function (e) {
    if (!/\d/.test(e.key)) {
      e.preventDefault();
    }
  });
});

// Применяем форматирование телефона к полю в форме регистрации
const registerPhoneInput = document.querySelector(
  '#register-form input[type="tel"]'
);
if (registerPhoneInput) {
  registerPhoneInput.value = "+7 (";

  registerPhoneInput.addEventListener("input", function (e) {
    const cursorPos = this.selectionStart;
    formatPhoneNumber(this);

    if (cursorPos < 4) {
      this.setSelectionRange(4, 4);
    }
  });

  registerPhoneInput.addEventListener("keypress", function (e) {
    if (!/\d/.test(e.key)) {
      e.preventDefault();
    }
  });
}

// Функция для обновления интерфейса после входа
function updateUIAfterLogin(user) {
  console.log("UPDATE UI AFTER LOGIN:", user);
  const loginLink = document.getElementById("login-link");
  const nav = document.querySelector("nav .container ul");

  if (loginLink && nav) {
    console.log("REMOVING LOGIN LINK");
    // Удаляем кнопку входа
    loginLink.parentElement.remove();

    console.log("ADDING PROFILE AND CART LINKS");
    // Добавляем кнопки профиля и корзины
    const profileLi = document.createElement("li");
    profileLi.innerHTML = `
      <a href="#" id="profile-link">
        <i class="fas fa-user"></i> ${user.full_name}
      </a>
    `;

    const cartLi = document.createElement("li");
    cartLi.innerHTML = `
      <a href="#" id="cart-link">
        <i class="fas fa-shopping-cart"></i> Корзина
      </a>
    `;

    nav.appendChild(profileLi);
    nav.appendChild(cartLi);

    // Добавляем обработчики для новых кнопок
    document
      .getElementById("profile-link")
      .addEventListener("click", function (e) {
        e.preventDefault();
        const profileModal = document.getElementById("profile-modal");
        if (profileModal) {
          profileModal.style.display = "block";
          // Заполняем данные профиля
          document.getElementById("profile-name").textContent = user.full_name;
          document.getElementById("profile-email").textContent = user.email;
          document.getElementById("profile-phone").textContent = user.phone;
        }
      });

    document
      .getElementById("cart-link")
      .addEventListener("click", function (e) {
        e.preventDefault();
        const cartModal = document.getElementById("cart-modal");
        if (cartModal) {
          cartModal.style.display = "block";
          updateCartContent();
        }
      });

    // Добавляем обработчики для кнопок в профиле
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        try {
          const response = await fetch("/api/logout", {
            method: "POST",
          });
          const data = await response.json();

          if (data.success) {
            showNotification("Выход выполнен успешно");
            // Закрываем модальное окно профиля
            document.getElementById("profile-modal").style.display = "none";
            // Перезагружаем страницу для обновления интерфейса
            window.location.reload();
          } else {
            showNotification(data.message || "Ошибка при выходе", "error");
          }
        } catch (error) {
          console.error("LOGOUT ERROR:", error);
          showNotification("Ошибка при выходе", "error");
        }
      });
    }

    const showOrderHistoryBtn = document.getElementById("show-order-history");
    if (showOrderHistoryBtn) {
      showOrderHistoryBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        try {
          const response = await fetch("/api/orders");
          const data = await response.json();

          if (data.success) {
            const orderHistoryModal = document.getElementById(
              "order-history-modal"
            );
            const orderHistoryList =
              document.getElementById("order-history-list");

            if (orderHistoryModal && orderHistoryList) {
              // Закрываем модальное окно профиля
              document.getElementById("profile-modal").style.display = "none";

              // Формируем HTML для списка заказов
              if (data.orders && data.orders.length > 0) {
                orderHistoryList.innerHTML = data.orders
                  .map((order) => {
                    return `
                      <div class="order-item">
                        <div class="order-header">
                          <span class="order-date">${new Date(
                            order.created_at
                          ).toLocaleDateString()}</span>
                          <span class="order-status">${
                            order.status === "new"
                              ? "Новый"
                              : order.status === "processing"
                              ? "В обработке"
                              : order.status === "completed"
                              ? "Выполнен"
                              : order.status === "cancelled"
                              ? "Отменен"
                              : "В обработке"
                          }</span>
                        </div>
                        <div class="order-items">
                          <div class="order-item-product">
                            <div class="order-item-details">
                              <h4>${order.items}</h4>
                              <p>${order.total.toLocaleString()} ₽</p>
                            </div>
                          </div>
                        </div>
                        <div class="order-total">Итого: ${order.total.toLocaleString()} ₽</div>
                      </div>
                    `;
                  })
                  .join("");
              } else {
                orderHistoryList.innerHTML =
                  '<p class="no-orders">У вас пока нет заказов</p>';
              }

              // Показываем модальное окно истории заказов
              orderHistoryModal.style.display = "block";
            }
          } else {
            showNotification(
              data.message || "Ошибка при получении истории заказов",
              "error"
            );
          }
        } catch (error) {
          console.error("ORDER HISTORY ERROR:", error);
          showNotification("Ошибка при получении истории заказов", "error");
        }
      });
    }
  } else {
    console.log("LOGIN LINK OR NAV NOT FOUND:", { loginLink, nav });
  }
}

// Функция для отображения модального окна оформления заказа
function showCheckoutModal() {
  const modal = document.getElementById("checkout-modal");
  const closeBtn = modal.querySelector(".close");

  // Обновляем информацию о заказе
  updateCheckoutSummary();

  // Показываем модальное окно
  modal.style.display = "block";

  // Обработчик закрытия
  closeBtn.onclick = function () {
    modal.style.display = "none";
  };

  // Закрытие по клику вне модального окна
  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

// Функция обновления информации о заказе в модальном окне
function updateCheckoutSummary() {
  const itemsCount = document.getElementById("checkout-items-count");
  const total = document.getElementById("checkout-total");
  const totalBtn = document.getElementById("checkout-total-btn");

  // Получаем данные корзины
  fetch("/api/cart")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        itemsCount.textContent = data.items.length;
        const totalAmount = data.total.toLocaleString() + " ₽";
        total.textContent = totalAmount;
        totalBtn.textContent = totalAmount;
      }
    })
    .catch((error) => {
      console.error("Error updating checkout summary:", error);
      showNotification("Ошибка при обновлении информации о заказе", "error");
    });
}

// Функция валидации формы заказа
function validateCheckoutForm(formData) {
  // Проверка обязательных полей
  if (!formData.full_name) {
    showNotification("Пожалуйста, введите ФИО", "error");
    return false;
  }

  if (!formData.phone) {
    showNotification("Пожалуйста, введите номер телефона", "error");
    return false;
  }

  if (!formData.email) {
    showNotification("Пожалуйста, введите email", "error");
    return false;
  }

  // Проверка телефона
  const phoneRegex = /^\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}$/;
  if (!phoneRegex.test(formData.phone)) {
    showNotification("Пожалуйста, введите корректный номер телефона", "error");
    return false;
  }

  // Проверка email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    showNotification("Пожалуйста, введите корректный email", "error");
    return false;
  }

  // Проверка адреса при выборе доставки
  if (formData.delivery === "delivery" && !formData.address) {
    showNotification("Пожалуйста, укажите адрес доставки", "error");
    return false;
  }

  // Проверка полей в зависимости от способа оплаты
  if (formData.payment_method === "card") {
    // Проверяем поля карты только если выбран способ оплаты картой
    if (!formData.card_number || !formData.card_expiry || !formData.card_cvv) {
      showNotification(
        "Пожалуйста, заполните все поля банковской карты",
        "error"
      );
      return false;
    }
  } else if (formData.payment_method === "wallet") {
    // Проверяем поля кошелька только если выбран способ оплаты кошельком
    if (!formData.wallet_number || !formData.wallet_holder) {
      showNotification(
        "Пожалуйста, заполните все поля онлайн-кошелька",
        "error"
      );
      return false;
    }
  }
  // Для оплаты наличными (cash) дополнительных полей не требуется

  return true;
}

// Функция очистки корзины после успешного заказа
function clearCart() {
  fetch("/api/cart/clear", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateCartCount();
        updateCartContent();
      }
    })
    .catch((error) => {
      console.error("Error clearing cart:", error);
    });
}

// Обработчик изменения способа доставки
document.querySelectorAll('input[name="delivery"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    const addressField = document.getElementById("delivery-address");
    if (this.value === "delivery") {
      addressField.style.display = "block";
      addressField.querySelector("input").required = true;
    } else {
      addressField.style.display = "none";
      addressField.querySelector("input").required = false;
    }
  });
});

// Обработчик изменения способа оплаты
document.querySelectorAll('input[name="payment"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    const cardFields = document.getElementById("card-payment-fields");
    const walletFields = document.getElementById("wallet-payment-fields");

    // Скрываем все поля
    cardFields.style.display = "none";
    walletFields.style.display = "none";

    // Отключаем обязательные поля для всех методов оплаты
    document.querySelectorAll('#card-payment-fields input').forEach(input => {
      input.required = false;
    });
    document.querySelectorAll('#wallet-payment-fields input').forEach(input => {
      input.required = false;
    });

    // Показываем нужные поля в зависимости от выбранного способа оплаты
    if (this.value === "card") {
      cardFields.style.display = "block";
      // Делаем поля карты обязательными
      document.querySelectorAll('#card-payment-fields input').forEach(input => {
        input.required = true;
      });
    } else if (this.value === "wallet") {
      walletFields.style.display = "block";
      // Делаем поля кошелька обязательными
      document.querySelectorAll('#wallet-payment-fields input').forEach(input => {
        input.required = true;
      });
    }
  });
});

function showOrderHistory() {
  fetch("/api/orders")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const orderHistoryList = document.getElementById("order-history-list");
        if (orderHistoryList) {
          if (data.orders && data.orders.length > 0) {
            orderHistoryList.innerHTML = data.orders
              .map(
                (order) => `
                <div class="order-item">
                  <div class="order-header">
                    <span class="order-date">${new Date(
                      order.created_at
                    ).toLocaleDateString()}</span>
                    <span class="order-status">${
                      order.status === "new"
                        ? "Новый"
                        : order.status === "processing"
                        ? "В обработке"
                        : order.status === "completed"
                        ? "Выполнен"
                        : order.status === "cancelled"
                        ? "Отменен"
                        : "В обработке"
                    }</span>
                  </div>
                  <div class="order-items">
                    <div class="order-item-product">
                      <div class="order-item-details">
                        <h4>${order.items}</h4>
                        <p>${order.total.toLocaleString()} ₽</p>
                      </div>
                    </div>
                  </div>
                  <div class="order-total">Итого: ${order.total.toLocaleString()} ₽</div>
                </div>
              `
              )
              .join("");
          } else {
            orderHistoryList.innerHTML =
              '<p class="no-orders">У вас пока нет заказов</p>';
          }
        }
      } else {
        showNotification(
          data.message || "Ошибка при получении истории заказов",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("ORDER HISTORY ERROR:", error);
      showNotification("Ошибка при получении истории заказов", "error");
    });
}

// Функция для фильтрации продуктов
function filterProducts(searchTerm) {
  const products = document.querySelectorAll(".product-card");
  searchTerm = searchTerm.toLowerCase();

  products.forEach((product) => {
    const productName = product
      .querySelector(".product-title")
      .textContent.toLowerCase();
    if (productName.includes(searchTerm)) {
      product.style.display = "block";
    } else {
      product.style.display = "none";
    }
  });
}

// Добавляем обработчик поиска при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.querySelector(".search input");
  const clearSearchBtn = document.querySelector(".clear-search");

  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      filterProducts(e.target.value);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", function () {
      searchInput.value = "";
      filterProducts("");
    });
  }
});

// Добавляем глобальные функции для обработки событий
window.handleRemoveItem = async function (productId) {
  console.log("handleRemoveItem called:", productId);
  try {
    const response = await fetch(`/api/cart/remove/${productId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to remove item");
    }

    console.log("Item removed successfully");
    updateCartContent();
  } catch (error) {
    console.error("Error removing item:", error);
    showNotification("Ошибка при удалении товара", "error");
  }
};

// Обработчик отправки формы заказа
document
  .getElementById("checkout-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    // Получаем данные формы
    const formData = {
      full_name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      delivery: document.querySelector('input[name="delivery"]:checked').value,
      address: document.getElementById("address").value.trim(),
      payment_method: document.querySelector('input[name="payment"]:checked')
        .value,
      comment: document.getElementById("comments").value.trim(),
    };

    // Добавляем данные в зависимости от способа оплаты
    if (formData.payment_method === "card") {
      formData.card_number = document
        .getElementById("card-number")
        .value.trim();
      formData.card_expiry = document
        .getElementById("card-expiry")
        .value.trim();
      formData.card_cvv = document.getElementById("card-cvv").value.trim();
    } else if (formData.payment_method === "wallet") {
      formData.wallet_number = document
        .getElementById("wallet-number")
        .value.trim();
      formData.wallet_holder = document
        .getElementById("wallet-holder")
        .value.trim();
    }

    // Валидация формы
    if (!validateCheckoutForm(formData)) {
      return;
    }

    // Отправляем заказ на сервер
    fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Закрываем модальное окно оформления заказа
          document.getElementById("checkout-modal").style.display = "none";

          // Показываем модальное окно успешного оформления
          const successModal = document.getElementById("order-success-modal");
          document.getElementById("order-number").textContent = data.orderId;
          successModal.style.display = "block";

          // Очищаем корзину
          clearCart();

          // Обработчик закрытия окна успеха
          successModal.querySelector(".close").onclick = function () {
            successModal.style.display = "none";
          };

          // Обработчик кнопки "Продолжить покупки"
          successModal.querySelector(".continue-shopping-btn").onclick =
            function () {
              successModal.style.display = "none";
            };
        } else {
          showNotification(
            data.message || "Ошибка при оформлении заказа",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error submitting order:", error);
        showNotification("Ошибка при оформлении заказа", "error");
      });
  });
