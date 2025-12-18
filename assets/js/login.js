// assets/js/login.js
import { pb, persistAuth } from "./auth.js";

const stepEmail = document.getElementById("step-email");
const stepChurch = document.getElementById("step-church");
const stepPassword = document.getElementById("step-password");

const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email-input");
const emailError = document.getElementById("email-error");

const churchList = document.getElementById("church-list");
const backToEmail = document.getElementById("back-to-email");

const churchTitle = document.getElementById("church-title");
const passwordForm = document.getElementById("password-form");
const passwordInput = document.getElementById("password-input");
const passwordError = document.getElementById("password-error");

let selectedChurch = null;
let emailForLogin = "";

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  emailError.textContent = "";
  const email = emailInput.value.trim();
  if (!email) return;

  emailForLogin = email;

  try {
    const res = await fetch("https://app.holycrm.app/backend/api/churches/by-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error iglesias:", res.status, text);
      throw new Error(`Error consultando iglesias (${res.status}): ${text}`);
    }

    const churches = await res.json();

    // Guardamos TODAS las iglesias del usuario
    localStorage.setItem("holycrm_churches", JSON.stringify(churches));

    if (!Array.isArray(churches) || churches.length === 0) {
      emailError.textContent =
        "No encontramos iglesias asociadas a este email.";
      return;
    }

    if (churches.length === 1) {
      selectedChurch = churches[0];
      showPasswordStep();
      return;
    }

    // Varias iglesias: mostrar UI de selección
    churchList.innerHTML = "";
    churches.forEach((ch) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "church-item";
      btn.textContent = ch.name;
      btn.addEventListener("click", () => {
        selectedChurch = ch;
        showPasswordStep();
      });
      li.appendChild(btn);
      churchList.appendChild(li);
    });

    stepEmail.style.display = "none";
    stepChurch.style.display = "block";
  } catch (err) {
    console.error(err);
    emailError.textContent = err.message || "Error inesperado";
  }
});

backToEmail.addEventListener("click", () => {
  stepChurch.style.display = "none";
  stepEmail.style.display = "block";
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  passwordError.textContent = "";
  const password = passwordInput.value;

  if (!emailForLogin || !selectedChurch) {
    passwordError.textContent = "Falta email o iglesia.";
    return;
  }

  try {
    // Auth estándar de PocketBase
    await pb.collection("users").authWithPassword(emailForLogin, password);

    persistAuth();

    // Guardamos la iglesia ACTUAL por separado
    localStorage.setItem(
      "holycrm_current_church",
      JSON.stringify({
        id: selectedChurch.id,
        name: selectedChurch.name,
        role: selectedChurch.role,
      })
    );

    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    passwordError.textContent = "Credenciales inválidas o error al entrar.";
  }
});

function showPasswordStep() {
  stepEmail.style.display = "none";
  stepChurch.style.display = "none";
  stepPassword.style.display = "block";
  churchTitle.textContent = `Entrar a ${selectedChurch.name}`;
}
