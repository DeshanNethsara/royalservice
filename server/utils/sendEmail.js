const sendEmail = async (options) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY, // We will add this to Render next
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { 
          name: 'Royal Service Center', 
          email: 'deshanspotify@gmail.com' 
        },
        to: [{ email: options.email }],
        subject: options.subject,
        htmlContent: options.html,
        // Handle PDF attachments for the Service Record
        attachment: options.attachments ? options.attachments.map(a => ({
          content: a.content.toString('base64'),
          name: a.filename
        })) : undefined
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API Error:', errorData);
      throw new Error(errorData.message || 'Email failed to send');
    }

    console.log('Email sent successfully via Brevo API!');
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

export default sendEmail;