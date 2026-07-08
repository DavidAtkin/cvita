const TO_ADDRESS = "admin@cvita.co.uk";
const FROM_ADDRESS = "website@cvita.co.uk";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  let data;

  try {
    data = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  // Honeypot field
  if (data.website) {
    return jsonResponse({ ok: true }, 200);
  }

  const name = (data.name || "").trim();
  const email = (data.email || "").trim();
  const company = (data.company || "").trim();
  const need = (data.need || "").trim();
  const message = (data.message || "").trim();

  if (!name || !email) {
    return jsonResponse({ ok: false, error: "Name and email are required." }, 400);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return jsonResponse({ ok: false, error: "Please provide a valid email address." }, 400);
  }


return new Response(
  JSON.stringify({
    CF_ACCOUNT_ID: !!env.CF_ACCOUNT_ID,
    CF_EMAIL_API_TOKEN: !!env.CF_EMAIL_API_TOKEN
  }),
  {
    headers: {
      "Content-Type": "application/json"
    }
  }
);


  const subject = `New enquiry from ${name}${company ? " (" + company + ")" : ""}`;

  const text =
    `New enquiry from the CVITA website contact form\n\n` +
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Company: ${company || "-"}\n` +
    `Service needed: ${need || "-"}\n\n` +
    `Message:\n${message || "-"}`;

  const html =
    `<h2 style="font-family:sans-serif;">New enquiry from the CVITA website</h2>` +
    `<p style="font-family:sans-serif;">` +
    `<strong>Name:</strong> ${escapeHtml(name)}<br>` +
    `<strong>Email:</strong> ${escapeHtml(email)}<br>` +
    `<strong>Company:</strong> ${escapeHtml(company || "-")}<br>` +
    `<strong>Service needed:</strong> ${escapeHtml(need || "-")}` +
    `</p>` +
    `<p style="font-family:sans-serif;">` +
    `<strong>Message:</strong><br>${escapeHtml(message || "-").replace(/\n/g, "<br>")}` +
    `</p>`;

  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: TO_ADDRESS,
          from: FROM_ADDRESS,
          subject,
          text,
          html
        })
      }
    );

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok || result.success === false) {
      console.error("Cloudflare Email Service error:", JSON.stringify(result));
      return jsonResponse(
        { ok: false, error: "Could not send your message. Please try again shortly." },
        502
      );
    }

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error("Contact form send failed:", err);

    return jsonResponse(
      { ok: false, error: "Could not send your message. Please try again shortly." },
      500
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
