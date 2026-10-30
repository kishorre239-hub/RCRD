import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
    }

    // Check if credentials are set
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.warn('GMAIL_USER or GMAIL_PASS environment variables are not set.');
      return NextResponse.json({ 
        error: 'Email service not configured. Please add GMAIL_USER and GMAIL_PASS to .env.local' 
      }, { status: 500 });
    }

    // Create a transporter using Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Send emails
    const sendPromises = emails.map(async (email: string) => {
      const mailOptions = {
        from: `"Geonixa. Workspace" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'You have been invited to join Geonixa.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4F46E5; margin: 0;">Geonixa.</h1>
            </div>
            <h2 style="color: #333;">You're Invited!</h2>
            <p style="color: #555; line-height: 1.6;">
              Hello,<br><br>
              You have been invited by <strong>Hari Kishore Reddy</strong> to join their workspace on <strong>Geonixa.</strong>
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3000/login" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #888; font-size: 12px; text-align: center;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      };

      return transporter.sendMail(mailOptions);
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, message: 'Invitations sent successfully' });

  } catch (error: unknown) {
    console.error('Error sending emails:', error);
    const message = error instanceof Error ? error.message : 'Failed to send emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
