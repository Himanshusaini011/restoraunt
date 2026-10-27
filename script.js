
/*
  Olive & Ember - Restaurant Reservation App
  Supabase JavaScript client v2
*/

// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://wooaghexiualilwzfvyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_74PQxMssf55HDr3iDpQ3Kw_vBotS2Wu";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// 2. GET HTML ELEMENTS
const authDialog = document.getElementById("auth-dialog");
const authForm = document.getElementById("auth-form");
const authOpen = document.getElementById("auth-open");
const authClose = document.getElementById("auth-close");
const authSwitch = document.getElementById("auth-switch");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmit = document.getElementById("auth-submit");
const authMessage = document.getElementById("auth-message");
const nameField = document.getElementById("name-field");
const authName = document.getElementById("auth-name");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");

const userStatus = document.getElementById("user-status");
const logoutBtn = document.getElementById("logout-btn");
const reservationForm = document.getElementById("reservation-form");
const guestName = document.getElementById("guest-name");
const bookingDate = document.getElementById("booking-date");
const bookingTime = document.getElementById("booking-time");
const guestCount = document.getElementById("guest-count");
const specialRequest = document.getElementById("special-request");
const bookingMessage = document.getElementById("booking-message");
const myBookings = document.getElementById("my-bookings");

// 3. APPLICATION STATE
let currentUser = null;
let authMode = "login";

// Use the visitor's local calendar date, not UTC.
const today = new Date();
const localToday = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

bookingDate.min = localToday;

// 4. HELPER FUNCTIONS
function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function clearMessages() {
  showMessage(authMessage, "");
  showMessage(bookingMessage, "");
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";

  authTitle.textContent = isSignup ? "Create account" : "Sign in";
  authSubtitle.textContent = isSignup
    ? "Join us and reserve your next table."
    : "Sign in to reserve your table.";

  authSubmit.textContent = isSignup
    ? "Create account"
    : "Sign in";

  nameField.classList.toggle("hidden", !isSignup);
  authName.required = isSignup;
  authPassword.autocomplete = isSignup
    ? "new-password"
    : "current-password";

  document.getElementById("switch-text").textContent = isSignup
    ? "Already have an account?"
    : "Don't have an account?";

  authSwitch.textContent = isSignup ? "Sign in" : "Create account";
  showMessage(authMessage, "");
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  authForm.reset();

  if (!authDialog.open) {
    authDialog.showModal();
  }
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );
}

function formatTime(time) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

// 5. AUTHENTICATION
authOpen.addEventListener("click", () => openAuth("login"));

authClose.addEventListener("click", () => authDialog.close());

authSwitch.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  authSubmit.disabled = true;
  showMessage(authMessage, "Please wait...");

  const email = authEmail.value.trim();
  const password = authPassword.value;
  const fullName = authName.value.trim();

  try {
    let result;

    if (authMode === "signup") {
      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
    } else {
      result = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      showMessage(
        authMessage,
        "Account created. Check your email for the confirmation link.",
        "success"
      );
      authForm.reset();
      return;
    }

    authDialog.close();
    authForm.reset();
    showMessage(bookingMessage, "You are signed in.", "success");
  } catch (error) {
    showMessage(authMessage, error.message || "Authentication failed.", "error");
  } finally {
    authSubmit.disabled = false;
  }
});

// 6. LOGOUT
logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    showMessage(bookingMessage, "You have signed out.", "success");
  } catch (error) {
    showMessage(bookingMessage, error.message, "error");
  } finally {
    logoutBtn.disabled = false;
  }
});

// 7. UPDATE THE USER INTERFACE
async function updateUserInterface(user) {
  currentUser = user;

  if (user) {
    const displayName =
      user.user_metadata?.full_name ||
      user.email ||
      "Account";

    userStatus.textContent = displayName;
    authOpen.classList.add("hidden");
    logoutBtn.classList.remove("hidden");

    guestName.value = user.user_metadata?.full_name || "";
    await loadMyBookings();
  } else {
    userStatus.textContent = "Guest";
    authOpen.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    myBookings.replaceChildren();
  }
}

// Listen for sign-in, sign-out, and session changes.
supabaseClient.auth.onAuthStateChange((event, session) => {
  // Defer database work outside the auth event callback.
  setTimeout(() => {
    updateUserInterface(session?.user ?? null);
  }, 0);
});

// 8. CREATE A RESERVATION
reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    openAuth("login");
    showMessage(
      authMessage,
      "Please sign in before reserving a table."
    );
    return;
  }

  const date = bookingDate.value;
  const time = bookingTime.value;
  const guests = Number(guestCount.value);

  if (date < localToday) {
    showMessage(bookingMessage, "Choose today or a future date.", "error");
    return;
  }

  if (date === localToday) {
    const [hours, minutes] = time.split(":").map(Number);
    const selectedTime = new Date();
    selectedTime.setHours(hours, minutes, 0, 0);

    if (selectedTime <= new Date()) {
      showMessage(
        bookingMessage,
        "Please choose a future reservation time.",
        "error"
      );
      return;
    }
  }

  if (guests < 1 || guests > 6) {
    showMessage(bookingMessage, "Choose between 1 and 6 guests.", "error");
    return;
  }

  const submitButton = reservationForm.querySelector(
    'button[type="submit"]'
  );
  submitButton.disabled = true;
  showMessage(bookingMessage, "Saving your reservation...");

  try {
    const reservation = {
      user_id: currentUser.id,
      guest_name: guestName.value.trim(),
      reservation_date: date,
      reservation_time: time,
      guest_count: guests,
      special_request: specialRequest.value.trim()
    };

    if (!reservation.guest_name) {
      throw new Error("Please enter your name.");
    }

    const { error } = await supabaseClient
      .from("reservations")
      .insert(reservation);

    if (error) throw error;

    showMessage(
      bookingMessage,
      "Reservation submitted successfully!",
      "success"
    );

    bookingTime.value = "";
    guestCount.value = "2";
    specialRequest.value = "";

    await loadMyBookings();
  } catch (error) {
    showMessage(
      bookingMessage,
      error.message || "Could not save your reservation.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
  }
});

// 9. DISPLAY THE SIGNED-IN USER'S RESERVATIONS
async function loadMyBookings() {
  if (!currentUser) return;

  const userId = currentUser.id;

  const { data, error } = await supabaseClient
    .from("reservations")
    .select(
      "id, guest_name, reservation_date, reservation_time, guest_count, status"
    )
    .eq("user_id", userId)
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });

  if (error) {
    showMessage(bookingMessage, error.message, "error");
    return;
  }

  myBookings.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "My reservations";
  myBookings.appendChild(heading);

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "You have no reservations yet.";
    myBookings.appendChild(empty);
    return;
  }

  data.forEach((booking) => {
    const item = document.createElement("article");
    item.className = "booking-item";

    const details = document.createElement("p");
    details.textContent =
      `${formatDate(booking.reservation_date)} at ` +
      `${formatTime(booking.reservation_time)} · ` +
      `${booking.guest_count} guest(s) · ${booking.status}`;

    item.appendChild(details);

    if (booking.status === "pending" || booking.status === "confirmed") {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.textContent = "Cancel reservation";

      cancelButton.addEventListener("click", async () => {
        const shouldCancel = confirm(
          "Are you sure you want to cancel this reservation?"
        );

        if (!shouldCancel) return;

        cancelButton.disabled = true;

        const { error: cancelError } = await supabaseClient
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", booking.id)
          .eq("user_id", userId);

        if (cancelError) {
          showMessage(bookingMessage, cancelError.message, "error");
          cancelButton.disabled = false;
          return;
        }

        showMessage(bookingMessage, "Reservation cancelled.", "success");
        await loadMyBookings();
      });

      item.appendChild(cancelButton);
    }

    myBookings.appendChild(item);
  });
}

// 10. RESTORE THE EXISTING SESSION ON PAGE LOAD
async function initializeApp() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showMessage(bookingMessage, error.message, "error");
    return;
  }

  await updateUserInterface(data.session?.user ?? null);
}

initializeApp();
