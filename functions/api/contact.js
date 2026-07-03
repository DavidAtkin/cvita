// Cloudflare Pages Function
// Handles POST /api/contact — receives the contact form submission from index.html,
// validates it, and sends it as an email via Cloudflare Email Service.
//
// Required Pages project environment variables (set in Cloudflare dashboard under
// Workers & Pages > [project] > Settings > Environment variables):
//   CF_ACCOUNT_ID        — your Cloudflare account ID
//   CF_EMAIL_API_TOKEN   — an API token with the Email Sending "Send" permission (mark as Secret)
//
// Prerequisite: the sending domain (cvita.co.uk) must be onboarded under
// Cloudflare dashboard > Email Sending > Onboard Domain, and must use Cloudflare DNS.

const TO_ADDRESS = "admin@cvita.co.uk";
const FROM_ADDRESS = "website@cvita.co.uk"; // must be on the onboarded/verified sending domain

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Honeypot: a hidden field ("website") that real users never fill in.
  // If it has a value, silently pretend success so bots don't learn anything.
  if (data.website) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const name = (data.name || "").trim();
  const email = (data.email || "").trim();
  const company = (data.company || "").trim();
  const need = (data.need || "").trim();
  const message = (data.message || "").trim();

  if (!name || !email) {
    return new Response(JSON.stringify({ ok: false, error: "Name and email are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: "Please provide a valid email address." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN) {
    return new Response(
      JSON.stringify({ ok: false, error: "Email is not configured on the server yet." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

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
    `<p style="font-family:sans-serif;"><strong>Name:</strong> ${escapeHtml(name)}<br>` +
    `<strong>Email:</strong> ${escapeHtml(email)}<br>` +
    `<strong>Company:</strong> ${escapeHtml(company || "-")}<br>` +
    `<strong>Service needed:</strong> ${escapeHtml(need || "-")}</p>` +
    `<p style="font-family:sans-serif;"><strong>Message:</strong><br>${escapeHtml(message || "-").replace(/\n/g, "<br>")}</p>`;

  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: TO_ADDRESS,
          from: FROM_ADDRESS,
          subject,
          text,
          html,
        }),
      }
    );

    const result = await resp.json();

    if (!resp.ok || result.success === false) {
      console.error("Cloudflare Email Service error:", JSON.stringify(result));
      return new Response(
        JSON.stringify({ ok: false, error: "Could not send your message. Please try again shortly." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Contact form send failed:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Could not send your message. Please try again shortly." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Reject any method other than POST with a clean 405 rather than falling through.
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: false, error: "Method not allowed." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
