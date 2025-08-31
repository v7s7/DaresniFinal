import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Email service configuration
let emailService: 'resend' | 'smtp' | null = null;
let resend: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

// Initialize email service based on environment variables
if (process.env.RESEND_API_KEY) {
  emailService = 'resend';
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('Email service initialized with Resend');
} else if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
  emailService = 'smtp';
  smtpTransporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('Email service initialized with SMTP');
} else {
  console.warn('No email service configured. Set RESEND_API_KEY or SMTP credentials.');
}

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

// Send email using configured service
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!emailService) {
    console.warn('Email service not configured, skipping email send');
    return;
  }

  try {
    if (emailService === 'resend' && resend) {
      const fromEmail = process.env.RESEND_FROM || 'Daresni <noreply@example.com>';
      
      for (const to of options.to) {
        await resend.emails.send({
          from: fromEmail,
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      }
    } else if (emailService === 'smtp' && smtpTransporter) {
      const fromEmail = process.env.SMTP_FROM || 'Daresni <noreply@example.com>';
      
      await smtpTransporter.sendMail({
        from: fromEmail,
        to: options.to.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    }
    
    console.log(`Email sent successfully to ${options.to.length} recipients: ${options.subject}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Get all admin email addresses from database
export async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.role, 'admin'));
    
    return admins
      .map(admin => admin.email)
      .filter((email): email is string => email !== null);
  } catch (error) {
    console.error('Failed to get admin emails:', error);
    return [];
  }
}

// Send email to all admins
export async function sendToAdmins(subject: string, html: string, text?: string): Promise<void> {
  const adminEmails = await getAdminEmails();
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found, skipping admin notification');
    return;
  }

  await sendEmail({
    to: adminEmails,
    subject,
    html,
    text,
  });
}

// Template for tutor registration notification
export function createTutorRegistrationEmail(tutorName: string, tutorEmail: string): { subject: string; html: string; text: string } {
  const subject = 'New Tutor Registration - Daresni';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Tutor Registration</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #9B1B30; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { 
          display: inline-block; 
          background-color: #9B1B30; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Tutor Registration</h1>
        </div>
        <div class="content">
          <h2>A new tutor has registered on Daresni!</h2>
          <p><strong>Tutor Name:</strong> ${tutorName}</p>
          <p><strong>Email:</strong> ${tutorEmail}</p>
          <p>Please review their profile and verify their credentials in the admin dashboard.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin" class="button">Review in Admin Dashboard</a>
          <p>Thank you for maintaining the quality of our tutoring platform!</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    New Tutor Registration - Daresni
    
    A new tutor has registered on Daresni!
    
    Tutor Name: ${tutorName}
    Email: ${tutorEmail}
    
    Please review their profile and verify their credentials in the admin dashboard.
    
    Admin Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin
  `;
  
  return { subject, html, text };
}