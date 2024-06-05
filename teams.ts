const webhookUrl =
  'https://jspac.webhook.office.com/webhookb2/d11d2f0d-7820-4684-b721-e0d8e9a94ab8@4b220568-ffe7-4204-a3c5-5c6bebc60ab9/IncomingWebhook/1a693644edbc449c8a1ce9306d9c13ef/4a134898-79cd-4a70-9405-abfecd2879f4';
const sendTeamsNotification = async (
  webhookUrl: string,
  message: string,
  title?: string,
): Promise<void> => {
  try {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: title || 'Notification',
      themeColor: '0076D7',
      sections: [
        {
          activityTitle: title || 'Notification',
          text: message, // This field supports markdown
          markdown: true, // Enable markdown
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('Notification sent successfully!');
    } else {
      console.error(`Failed to send notification. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const message =
  '**This** is a _test_ notification from our system.\n\n- Item 1\n- Item 2\n- Item 3';
const title = 'Test Notification';

sendTeamsNotification(webhookUrl, message, title);
