// v1.0.3 Gr8terThings - Cloudflare Worker: Send Welcome Email via MailerSend
// Triggered daily via cron
//
// Changelog:
// - Nested MailerSend variables properly using subscriber object
// - Ensures {{ subscriber.first_name }} and {{ subscriber.email }} work in the MailerSend template

export default {
  async fetch(request, env, ctx) {
    return new Response("Scheduled Worker - Use cron trigger only.", { status: 200 });
  },

  async scheduled(event, env, ctx) {
    const AIRTABLE_API_KEY = env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID;
    const MAILERSEND_API_KEY = env.MAILERSEND_API_KEY;
    const TEMPLATE_ID = "pxkjn411vq04z781";

    const TABLE_ID = "tblnn4fS7cSkcJW12";
    const VIEW_NAME = "Pending Welcome Email";

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}?view=${encodeURIComponent(VIEW_NAME)}`;
    const airtableRes = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!airtableRes.ok) {
      console.error("❌ Failed to fetch from Airtable", await airtableRes.text());
      return;
    }

    const { records } = await airtableRes.json();
    console.log(`✅ Fetched ${records.length} subscriber(s) from Airtable.`);

    for (const record of records) {
      const email = record.fields["Email"];
      const rawFirstName = record.fields["First Name"];
      const firstName = rawFirstName || "there";

      console.log(`📨 Preparing email for: "${rawFirstName}" <${email}>`);

      const payload = {
        template_id: TEMPLATE_ID,
        from: {
          email: "chad.mowery@gr8terthings.com",
          name: "Chad from GR8R"
        },
        to: [{ email, name: firstName }],
        variables: [
          {
            email,
            substitutions: [
              {
                var: "subscriber",
                value: {
                  first_name: firstName,
                  email: email
                }
              }
            ]
          }
        ]
      };

      console.log("📦 MailerSend payload:", JSON.stringify(payload, null, 2));

      const emailRes = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MAILERSEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!emailRes.ok) {
        console.error(`❌ Failed to send email to ${email}:`, await emailRes.text());
        continue;
      }

      console.log(`✅ Email sent to ${email}`);

      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}/${record.id}`;
      const patchRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "Welcome Email Sent?": true
          }
        })
      });

      if (!patchRes.ok) {
        console.error(`⚠️ Failed to update Airtable for ${email}:`, await patchRes.text());
      } else {
        console.log(`📒 Airtable updated for ${email}`);
      }
    }
  },
};
