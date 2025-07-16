const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Send OTP email
const sendOTPEmail = async (email, otp, name) => {
  const mailOptions = {
    from: `"civilshq.com" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Email Verification - Civils HQ',
    html:`
     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 20px; text-align: center;">
    <h1 style="color: #f1f5f9; margin: 0;">Civils HQ</h1>
  </div>

  <!-- Body -->
  <div style="padding: 30px; background-color: #f8fafc;">
    <h2 style="color: #0f172a; margin-bottom: 20px;">Email Verification</h2>
    <p style="color: #334155; font-size: 16px;">Hi ${name},</p>
    <p style="color: #334155; font-size: 16px;">Thank you for registering with CivilsHQ. Please use the following OTP to verify your email:</p>

    <!-- OTP Box -->
    <div style="background-color: #ffffff; padding: 20px; text-align: center; margin: 30px 0; border-radius: 10px; border: 2px solid #e2e8f0;">
      <h1 style="color: #8b5cf6; margin: 0; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
    </div>

    <p style="color: #475569; font-size: 14px;">This OTP is valid for 10 minutes.</p>
    <p style="color: #475569; font-size: 14px;">If you didn't request this, please ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
      This is an automated email. Please do not reply to this email.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #0f172a; padding: 20px; text-align: center;">
    <p style="color: #f1f5f9; margin: 0; font-size: 14px;">© 2025 civilshq.com . All rights reserved.</p>
  </div>
</div>

    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

module.exports = { sendOTPEmail };