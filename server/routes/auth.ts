import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Physiotherapist } from '../models/Physiotherapist';
import { Notification } from '../models/Notification';
import { authenticate, AuthenticatedRequest, signToken } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res: Response) => {
  try {
    const { name, email, password, phone, dateOfBirth, gender, address, medicalHistory } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'patient',
      phone: phone ? String(phone).trim() : '',
      dateOfBirth: dateOfBirth || '',
      gender: gender || '',
      address: address || '',
      medicalHistory: medicalHistory || '',
    });

    await Notification.create({
      userId: user._id,
      title: 'Welcome to PhysioCare',
      message: 'Your patient account is active. Browse treatments and book 30-minute IST slots anytime.',
      type: 'system',
    });

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        medicalHistory: user.medicalHistory,
        emergencyContact: user.emergencyContact,
      },
    });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated. Contact clinic admin.' });
      return;
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    let physiotherapistId: string | undefined;
    if (user.role === 'physiotherapist') {
      const physio = await Physiotherapist.findOne({ userId: user._id }).select('_id');
      physiotherapistId = physio?._id.toString();
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        medicalHistory: user.medicalHistory,
        emergencyContact: user.emergencyContact,
        physiotherapistId,
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash').lean();
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let physiotherapistId: string | undefined;
    if (user.role === 'physiotherapist') {
      const physio = await Physiotherapist.findOne({ userId: user._id }).select('_id').lean();
      physiotherapistId = physio?._id.toString();
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        medicalHistory: user.medicalHistory,
        emergencyContact: user.emergencyContact,
        physiotherapistId,
      },
    });
  } catch (err) {
    console.error('[Auth Me Error]', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, dateOfBirth, gender, address, medicalHistory, emergencyContact } =
      req.body;

    if (!name || String(name).trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }

    const updated = await User.findByIdAndUpdate(
      req.user!.userId,
      {
        $set: {
          name: String(name).trim(),
          phone: phone !== undefined ? String(phone).trim() : '',
          dateOfBirth: dateOfBirth ?? '',
          gender: gender ?? '',
          address: address ?? '',
          medicalHistory: medicalHistory ?? '',
          emergencyContact: emergencyContact ?? '',
        },
      },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
        role: updated.role,
        phone: updated.phone,
        dateOfBirth: updated.dateOfBirth,
        gender: updated.gender,
        address: updated.address,
        medicalHistory: updated.medicalHistory,
        emergencyContact: updated.emergencyContact,
      },
    });
  } catch (err) {
    console.error('[Profile Update Error]', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
