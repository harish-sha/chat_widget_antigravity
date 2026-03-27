(function () {
  const currentScript = document.currentScript;

  const widgetId = "b421087020XX";
  // const widgetId = currentScript.getAttribute('data-widget-id');
  console.log(widgetId, " from index.js file");

  if (!widgetId) {
    console.error(
      "CPaaS Widget: No widget ID found. Please check your installation script.",
    );
    return;
  }

  loadCSS();

  fetch(`http://192.168.1.29:8000/widget/config/${widgetId}`)
    .then((res) => res.json())
    .then((data) => {
      window.chatWidgetConfig = data.config;
      const widgetConfig = data.config;
      applyStyles(widgetConfig);
      renderWidget(widgetConfig);
      renderForm(widgetConfig?.surveyForm?.surveyFormFields);
      renderFaqCards(widgetConfig?.widgetText?.conversationStarters);
    })
    .catch((err) => {
      console.error("Widget config fetch error:", err);
    });
})();


/* LOAD CSS */

function loadCSS() {
  const link = document.createElement("link");

  link.rel = "stylesheet";

  link.href = "http://192.168.1.29:8000/widget.css";

  document.head.appendChild(link);

  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Chivo:ital,wght@0,100..900;1,100..900&family=Comic+Relief:wght@400;700&family=Lora:ital,wght@0,400..700;1,400..700&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Playfair:ital,opsz,wght@0,5..1200,300..900;1,5..1200,300..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Rasa:ital,wght@0,300..700;1,300..700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Spectral:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&family=Tilt+Warp&display=swap";
  document.head.appendChild(fontLink);
}

/* APPLY STYLES */

function applyStyles(config) {
  document.documentElement.style.setProperty(
    "--home-main-bg",
    config?.widgetCss.selected?.value,
  );

  document.documentElement.style.setProperty(
    "--mobile-display",
    config?.visibility?.mobile?.mobileVisible ? "block" : "none",
  );

  document.documentElement.style.setProperty(
    "--desktop-display",
    config?.visibility?.desktop?.desktopVisible ? "block" : "none",
  );

  document.documentElement.style.setProperty(
    "--mobile-btn-size",
    `${config?.visibility?.mobile?.buttonSize}px`,
  );

  document.documentElement.style.setProperty(
    "--home-main-text",
    config?.widgetCss?.textColor,
  );
  document.documentElement.style.setProperty(
    "--home-top-bg",
    config?.widgetCss?.selected?.value, //done
  );
  document.documentElement.style.setProperty(
    "--home-top-action-bg",
    config?.widgetCss?.selectedActionColor?.value, //done
  );

  document.documentElement.style.setProperty(
    "--home-header-color",
    config?.widgetCss.homeHeaderColor,
  );
  document.documentElement.style.setProperty(
    "--home-header-logo",
    config?.widgetCss?.homeHeaderLogo,
  );

  document.documentElement.style.setProperty(
    "--bubble-color-in",
    config?.widgetCss?.chatBubbleColor, //done
  );
  document.documentElement.style.setProperty(
    "--bubble-color-in-text",
    config?.widgetCss?.chatBubbleColorInText,
  );
  document.documentElement.style.setProperty(
    "--bubble-color-out",
    config?.widgetCss?.chatBubbleColor, //done
  );
  document.documentElement.style.setProperty(
    "--bubble-color-out-text",
    config?.widgetCss?.chatBubbleColorOutText,
  );

  document.documentElement.style.setProperty(
    "--chat-msg-bg",
    config?.widgetCss?.chatBgColor, //done
  );

  document.documentElement.style.setProperty(
    "--button-launcher-color",
    config?.widgetCss?.chatBtnLauncherColor,
  );
}

function applyButtonSize(config) {
  const isMobile = window.innerWidth < 648;

  const padding = Number(config?.visibility?.mobile?.buttonSize) || 8;
  const iconSize = Math.max(16, padding * 1.5);

  const finalIconSize = isMobile ? iconSize : 26;

  const circle = document.getElementById("chat-circle");
  const svg = circle?.querySelector("svg");

  if (!circle || !svg) return;

  if (isMobile) {
    // Same logic as React
    circle.style.padding = `${padding}px`;
  } else {
    circle.style.padding = "16px";
  }

  // Icon size
  svg.style.width = `${finalIconSize}px`;
  svg.style.height = `${finalIconSize}px`;
}

function renderWidget(config = {}) {
  window.chatWidgetConfig = config;

  if (document.getElementById("chat-widget")) return;

  const mobilePosition =
    config?.visibility?.mobile?.mobilePosition === "left" ? "left" : "right";

  const desktopPosition =
    config?.visibility?.desktop?.desktopPosition === "left" ? "left" : "right";

  const container = document.createElement("div");

  document.body.appendChild(container);

  applyButtonSize(config);

  window.addEventListener("resize", () => {
    applyButtonSize(window.chatWidgetConfig);
  });

  container.id = "chat-widget";

  container.innerHTML = `
  <div class="chat-wrapper mobile-${mobilePosition} desktop-${desktopPosition}">

    <!-- Chat Box -->
   <div id="chat-box" class="chat-box mobile-${mobilePosition} desktop-${desktopPosition}">

      <div id="home-screen"></div>

      <div id="chat-screen" style="display:none;"></div>
      
      <div id="survey-screen" style="display:none;"></div>      
    </div>

    <!-- Launcher -->
    <div class="chat-launcher mobile-${mobilePosition} desktop-${desktopPosition}" onclick="toggleChat()">

      ${
        config?.visibility?.minimizedFloatingLabel?.showMinimizedLabel
          ? `<div class="chat-pill mobile-${mobilePosition} desktop-${desktopPosition}" id="chat-pill">
            ${config?.visibility?.minimizedFloatingLabel?.minimizedValue || ""}
           </div>`
          : ""
      }

      <div class="chat-circle" id="chat-circle">
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </div>

    </div>

  </div>
  `;

  document.body.appendChild(container);

  loadScreens(config);
  renderForm();
}

function openHelp() {
  const url = window.chatWidgetConfig?.other?.helpUrl;
  console.log("URL", url);
  if (!url) {
    console.warn("Help URL not configured");
    return;
  }

  window.open(url, "_blank");
}

function openWhatsapp() {
  const config = window.chatWidgetConfig;
  console.log("config", config);

  const phone = config?.other?.whatsappDetails?.phone;
  const message = config?.other.whatsappDetails?.desc;

  if (!phone) return;

  const url = `https://wa.me/${phone}?text=${message}`;
  window.open(url, "_blank");
}

// ********************************************************* Survey Form *****************************************
const formState = {};

function handleChange(name, value) {
  formState[name] = value;

  console.log(formState);
  // renderForm(); // re-render for radio highlight
}

function buildPayload(schema, formValues) {
  const answers = schema
    .filter((field) => formValues[field.id] !== undefined) // only filled fields
    .map((field) => ({
      fieldId: field.id,
      type: field.type,
      value: formValues[field.id],
      label: field.config?.label || "", // optional
    }));

  return { answers };
}

function handleSubmit(data) {
  const payload = buildPayload(schemaArray, formState);
  console.log("User Form Response:", payload);
  alert("Form submitted!");
}

// SAMPLE DATA (same structure as your React data)
// const data = {
//   configFormData: [
//     { type: "heading", config: { label: "User Info" } },
//     { type: "textInput", name: "name", config: { label: "Name", placeholder: "Enter name" } },
//     { type: "textArea", name: "message", config: { label: "Message", placeholder: "Enter message" } },
//     { type: "radioButton", name: "rating", config: { label: "Rate us", options: ["Good", "Average", "Bad"] } },
//     { type: "submitButton", config: { text: "Submit" } }
//   ]
// };

function renderForm(data) {
  console.log("data", data);
  const container = document.getElementById("surveyContent");

  if (!data || data.length === 0) {
    container.innerHTML = `<p>No form available</p>`;
    return;
  }

  container.innerHTML = data
    .map((item) => {
      switch (item.type) {
        case "heading":
          return `<h3>${item.config?.label || "Section"}</h3>`;

        case "textInput":
          return `
          <div class="field">
            <label>${item.config?.label}</label>
            <input 
              class="input"
              type="text"
              placeholder="${item.config?.placeholder}"
              value="${formState[item.name] || ""}"
              oninput="handleChange('${item.name}', this.value)"
            />
          </div>
        `;

        case "textArea":
          return `
          <div class="field">
            <label>${item.config?.label}</label>
            <textarea 
              class="textarea"
              placeholder="${item.config?.placeholder}"
              oninput="handleChange('${item.name}', this.value)"
            >${formState[item.name] || ""}</textarea>
          </div>
        `;

        case "radioButton":
          return `
          <div class="field">
            <p>${item.config?.label}</p>
            <div class="radio-group">
              ${item.config.options
                .map(
                  (opt) => `
                <div 
                  class="radio-option ${formState[item.name] === opt ? "active" : ""}"
                  onclick="handleChange('${item.name}', '${opt}')"
                >
                  <input type="radio" ${formState[item.name] === opt ? "checked" : ""}/>
                  <span>${opt}</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `;

        case "submitButton":
          return `
          <button class="submit-btn" onclick="handleSubmit(data)">
            ${item.config?.text || "Submit"}
          </button>
        `;

        default:
          return "";
      }
    })
    .join("");
}

// ********************************************************* Survey Form *****************************************

let open = false;
let screen = "home";

function homeScreenHTML(config) {
  return `
<div class="home-container">

  <!-- TOP SECTION -->
  <div class="home-top">

    <!-- Avatar -->
<div class="home-avatar">
  ${
    config?.logo?.link || config?.homeHeaderLogo
      ? `<img class="avatar-logo" src="${config?.logo?.link || config?.homeHeaderLogo}" alt="logo">`
      : `<span class="avatar-letter avatar-placeholder">${(config?.widgetText?.chatHeader).charAt(0).toUpperCase()}</span>`
  }
</div>

    <!-- Header + Message -->
    <div class="home-text">
      <h2 id="home-header">${config?.widgetText?.homeHeader || config.homeHeader}</h2>  
      <p id="home-message">${config?.widgetText?.homeMessage || config.homeMessage}</p>
    </div>

    ${
      config?.other?.showWhatsappIcon
        ? `<div class="whatsapp-icon" onclick="openWhatsapp()">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
      <path d="M13.601 2.326A7.854 7.854 0 0 0 8.004 0C3.58 0 0 3.58 0 8.003c0 1.412.37 2.79 1.07 4.003L0 16l4.114-1.055a7.96 7.96 0 0 0 3.89 1.006h.003c4.423 0 8.003-3.58 8.003-8.003a7.95 7.95 0 0 0-2.409-5.622zM8.007 14.5a6.48 6.48 0 0 1-3.304-.903l-.237-.14-2.44.626.652-2.377-.154-.244a6.47 6.47 0 0 1-1.002-3.46c0-3.584 2.92-6.504 6.505-6.504 1.736 0 3.368.676 4.594 1.902a6.47 6.47 0 0 1 1.904 4.602c-.002 3.584-2.922 6.504-6.506 6.504zm3.62-4.86c-.198-.099-1.173-.578-1.354-.644-.182-.066-.314-.099-.446.1-.132.198-.512.644-.628.777-.115.132-.231.148-.429.05-.198-.099-.837-.308-1.595-.982-.59-.525-.987-1.173-1.102-1.371-.115-.198-.012-.305.086-.404.09-.089.198-.231.297-.347.099-.116.132-.198.198-.33.066-.132.033-.248-.017-.347-.05-.099-.446-1.074-.611-1.471-.161-.386-.324-.334-.446-.34l-.38-.007c-.132 0-.347.05-.528.248-.182.198-.694.678-.694 1.653s.71 1.918.81 2.05c.099.132 1.4 2.137 3.393 2.997.474.204.843.326 1.131.417.475.151.907.13 1.249.079.381-.057 1.173-.479 1.339-.942.165-.462.165-.858.116-.942-.05-.083-.182-.132-.38-.231z"/>
    </svg>
  </div>`
        : ""
    }
    

  </div>

  <!-- FAQ SECTION -->
  <div class="faq-container" id="faq-container"></div>
  
  <!-- CHAT CARD -->
  <div class="chat-card" onclick="setScreen('chat')">

    <div class="chat-card-text">
      <p class="chat-title">${config?.visibility?.minimizedFloatingLabel?.minimizedValue || config.chatCardTitle}</p>
      <p class="chat-status">${config?.widgetText?.offlineStatus || config.chatCardStatus}</p>
    </div>

    <div class="chat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send" style="color: rgb(59, 44, 243);"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>
    </div>

  </div>

  <!-- BOTTOM NAV -->
  <div class="bottom-nav">

    <div class="nav-item active">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-house-door-fill" viewBox="0 0 16 16">
  <path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5"/>
</svg>
      <span class="icontext">Home</span>
    </div>

    <div class="nav-item" onclick="setScreen('chat')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat-left" viewBox="0 0 24 24">
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H6l-2 2V4h16z"/>
</svg>
      <span class="icontext">Chat</span>
    </div>

    ${
      config?.surveyForm?.enableSurveyForm
        ? `<div class="nav-item" onclick="setScreen('survey')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 11H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h9zM4 9h7V6H4zm11 11H4c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2h11zM4 18h9v-3H4zm18-9h-2l2-5h-7v7h2v9zM4.75 17.25h1.5v-1.5h-1.5zm0-9h1.5v-1.5h-1.5z"></path>
        </svg>
        <span class="icontext">Survey Form</span>
      </div>`
        : ""
    }

  </div>

  <!-- FOOTER -->
  <div class="home-footer">
   POWERED BY ${config?.widgetText?.poweredBy}
  </div>

</div>
`;
}

function chatScreenHTML(config) {
  return `
<div class="chat-container">

  <div class="chat-header">

    <div class="chat-header-left">

      <button class="back-btn" onclick="setScreen('home')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>
      </svg></button>

      <div class="chat-avatar">
  ${
    config?.logo?.link || config?.homeHeaderLogo
      ? `<img class="avatar-logo" src="${config?.logo?.link || config?.homeHeaderLogo}" alt="logo">`
      : `<span class="avatar-letter avatar-placeholder">${config?.widgetText?.chatHeader?.charAt(0).toUpperCase()}</span>`
  }
</div>

      <p class="chat-title">${config?.widgetText?.chatHeader}</p>

    </div>

    <button class="menu-btn" onclick="toggleOptions()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots-vertical" viewBox="0 0 16 16">
    <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
    </svg></button>

    <div class="chat-options" id="chat-options">
      <button onclick="clearChat()">Clear chat</button>
      <button onclick="restartChat()">Restart bot</button>
      <button onclick="openHelp()">Help</button>
    </div>

  </div>


  <div class="chat-messages" id="chat-messages">

    <div class="bot-message" id="welcome-message">
      ${config?.widgetText?.chatWelcomeMessage}
    </div>

  </div>

  <div class="quick-actions-wrapper" id="quick-replies"></div>

  <div class="chat-input">

    <input
      id="chat-input"
      type="text"
      placeholder="Type a message…"
      onkeydown="if(event.key==='Enter'){sendMessage()}"
    >

    <button onclick="sendMessage()"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg></button>

  </div>

  


  ${
    config?.other?.offlineTicket === true
      ? `
     <div class="offline-overlay" id="offline-overlay">

  <!-- Popup Box -->
  <div class="offline-popup">

    <!-- Header -->
    <div class="offline-header">

      <div class="offline-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>

      <button class="offline-close" onclick="closeOfflineTicket()">
  <svg xmlns="http://www.w3.org/2000/svg"
       width="20"
       height="20"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       stroke-width="2"
       stroke-linecap="round"
       stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
</button>

    </div>

    <!-- Text -->
    <p class="offline-text">
      We're currently unavailable. We’ll get back to you when one of our agents is able to respond. Please provide your email address.
    </p>

    <!-- Email -->
    <input
      type="email"
      class="offline-input"
      placeholder="Enter your email..."
    />

    <!-- Message -->
    <textarea
      class="offline-textarea"
      rows="4"
      placeholder="Enter your message..."
    ></textarea>

    <!-- Submit -->
    <button class="offline-send" onclick="submitOfflineTicket()">
      Send
    </button>

  </div>

</div>
    `
      : ``
  }

    ${
      config?.other?.privacyMsg === true
        ? `<div class="privacy-box" id="privacy-box">
      <p class="privacy-text">
        By using this chat, you agree to our Privacy Policy and Terms of Service.
      </p>

      <button class="privacy-close" onclick="closePrivacy()">✕</button>
    </div>`
        : ``
    }

    ${
      config?.other?.preChatSurvey === "true"
        ? `
       <div class="survey-overlay" id="survey-overlay">

  <div class="survey-popup">

    <!-- HEADER -->
    <div class="survey-header">

      <div class="survey-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>

      <button class="survey-close" onclick="closeSurvey()">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

    </div>

    <!-- TITLE -->
    <p class="survey-title">
      Please introduce yourself:
    </p>

    <!-- EMAIL -->
    <input
      type="email"
      class="survey-input"
      placeholder="Enter your email..."
    />

    <!-- SEND BUTTON -->
    <button class="survey-send" onclick="submitSurvey()">
      Send
    </button>

  </div>

</div>
      `
        : ``
    }

   
</div>
`;
}

function surveyScreenHTML(config) {
  return `
  <div class="survey-container">

  <!-- HEADER -->
  <div class="survey-header">
    <button class="back-btn" onclick="setScreen('home')">←</button>

    <div>
      <h2>Survey Form</h2>
      <p>Please fill out the details below</p>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="survey-content" id="surveyContent">
    <!-- Dynamic form will render here -->
  </div>

</div>
  `;
}

window.toggleChat = function () {
  const chatBox = document.getElementById("chat-box");
  const pill = document.getElementById("chat-pill");
  const circle = document.getElementById("chat-circle");
  const launcher = document.querySelector(".chat-launcher");

  open = !open;

  if (open) {
    chatBox.classList.remove("hide");
    chatBox.classList.add("show");

    if (pill) pill.style.display = "none";

    circle.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 24 24" fill="black">
  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
    `;
    launcher.style.right = "300px";
  } else {
    chatBox.classList.remove("show");
    chatBox.classList.add("hide");

    if (pill) pill.style.display = "block";

    circle.innerHTML = `
       <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="28" 
        height="30" 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <path 
          d="M4 4h16v10H7l-3 3V4z" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    `;
    launcher.style.right = "20px";

    if (!open) {
      chatBox.classList.remove("hide");
    }
  }
};

window.setScreen = function (value) {
  console.log("value", value);

  screen = value;

  const home = document.getElementById("home-screen");
  const chat = document.getElementById("chat-screen");
  const survey = document.getElementById("survey-screen");

  // Safety check
  if (!home || !chat || !survey) {
    console.error("Missing screen element", { home, chat, survey });
    return;
  }

  if (screen === "home") {
    home.style.display = "block";
    chat.style.display = "none";
    survey.style.display = "none";
  } else if (screen === "chat") {
    home.style.display = "none";
    chat.style.display = "block";
    survey.style.display = "none";
  } else if (screen === "survey") {
    home.style.display = "none";
    chat.style.display = "none";
    survey.style.display = "block";
  }
};

function toggleOptions() {
  const menu = document.getElementById("chat-options");

  if (menu.style.display === "flex") {
    menu.style.display = "none";
  } else {
    menu.style.display = "flex";
  }
}

document.addEventListener("click", function (e) {
  const menu = document.getElementById("chat-options");
  const btn = document.querySelector(".menu-btn");

  if (!btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});

function loadScreens(config) {
  document.getElementById("home-screen").innerHTML = homeScreenHTML(config);

  document.getElementById("chat-screen").innerHTML = chatScreenHTML(config);

  document.getElementById("survey-screen").innerHTML = surveyScreenHTML(config);
}

function sendMessage(customMessage = null) {
  const input = document.getElementById("chat-input");
  const message = customMessage || input.value.trim();

  if (!message) return;

  const chatBox = document.getElementById("chat-messages");

  // USER MESSAGE
  const msgDiv = document.createElement("div");
  msgDiv.className = "user-message";
  msgDiv.innerText = message;
  chatBox.appendChild(msgDiv);

  if (!customMessage) input.value = "";

  const match = window.currentQuickActions.find(
    (item) => item.label === message,
  );

  if (!match) return;

  const botReply = match.value;

  const typingDiv = document.createElement("div");
  typingDiv.className = "typing-indicator";
  typingDiv.innerText = "Bot is typing...";
  chatBox.appendChild(typingDiv);

  chatBox.scrollTop = chatBox.scrollHeight;

  setTimeout(() => {
    // REMOVE TYPING
    typingDiv.remove();

    // BOT MESSAGE
    const botMsg = document.createElement("div");
    botMsg.className = "bot-message";
    botMsg.innerText = botReply;
    chatBox.appendChild(botMsg);

    chatBox.scrollTop = chatBox.scrollHeight;
  }, 800);
}

function openStarterChat(text) {
  setScreen("chat");

  setTimeout(() => {
    const chatMessages = document.getElementById("chat-messages");
    const quickReplies = document.getElementById("quick-replies");

    // remove welcome
    const welcomeMsg = document.getElementById("welcome-message");
    if (welcomeMsg) welcomeMsg.remove();

    // FIND STARTER
    const starter =
      window?.chatWidgetConfig?.widgetText?.conversationStarters?.find(
        (item) => item.text === text,
      );

    window.currentQuickActions = starter?.quickActions || [];

    // RENDER QUICK ACTIONS ABOVE INPUT
    if (starter?.quickActions?.length > 0) {
      quickReplies.innerHTML = starter.quickActions
        .slice(1)
        .map(
          (action) => `
        <button class="quick-reply-btn" onclick="sendMessage('${action.label}')">
          ${action.label}
        </button>
      `,
        )
        .join("");
    } else {
      quickReplies.innerHTML = ""; // clear if none
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;

    // send to bot
    sendMessage(text);
  }, 50);
}

function renderFaqCards(conver) {
  const container = document.getElementById("faq-container");
  if (!conver) return;

  // filter enabled starters
  const enabledStarters = conver.filter((item) => item.enabled).slice(0, 5);

  enabledStarters.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "chat-card";

    if (index === 0) {
      card.classList.add("chat-card-first");
    }

    card.innerHTML = `
      <p class="chat-title">${item.text}</p>
    `;

    card.onclick = () => openStarterChat(item.text);

    container.appendChild(card);
  });
}

// renderWidget({
//   // minimizedValue: "Hello",   // main launcher text
//   homeText: "homeHeader",    // home screen header
//   homeMessage: "homeMessage",   // home screen message
//   chatCardTitle: "chatCardTitle",   // home screen header color
//   chatCardStatus: "chatCardStatus",   // home screen top color
//   // homeHeaderLogo: "http://localhost:5000/logo.png",   // home screen header logo
//   homeHeaderLogo: "https://png.pngtree.com/element_pic/00/16/09/2057e0eecf792fb.jpg",  // home screen header logo
//   chatScreenTitle: "chatScreenTitle",
//   chatCards:[
//     { text: "I have a question about the product", enabled: false },
//     { text: "Do you offer discount codes?", enabled: false },
//     { text: "What is my order status?", enabled: true },
//     { text: "What is my order status?", enabled: true }
//   ]
// });
