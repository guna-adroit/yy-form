import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const formData = await request.formData();

    // Get text fields
    const name = formData.get("name");
    const email = formData.get("email");
    const note = formData.get("note");
    const career_position = formData.get("career_position");

    // File field
    const file = formData.get("career_resume");

    if (!name || !email || !note || !career_position || !file) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert file → Buffer (required by Nodemailer)
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);

    // Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.MAIL_USER,
      subject: `New Career Application for ${career_position}`,
      html: `
        <h2>New Career Application</h2>
        <p><strong>Position:</strong> ${career_position}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Note:</strong></p>
        <p>${note}</p>
      `,
      attachments: [
        {
          filename: file.name,
          content: fileBuffer,
          contentType: file.type, // application/pdf
        },
      ],
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Email error:", error);
    return Response.json(
      { success: false, error: "Email failed to send" },
      { status: 500 }
    );
  }
}
