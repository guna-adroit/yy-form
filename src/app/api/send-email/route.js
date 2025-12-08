import nodemailer from 'nodemailer';

export async function POST(request) {
  
  try {
    const body = await request.json();
    const { name, email, message, applyfor } = body;

    if (!name || !email || !message || !applyfor) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    const success = await transporter.verify();
    console.log('Transporter ready?', success);

    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.MAIL_USER,
      subject: `New Enquiry for ${applyfor}`,
      html: `
        <h2>New Career Enquiry for ${applyfor}</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ success: false, error: 'Email failed to send' }, { status: 500 });
  }
}
