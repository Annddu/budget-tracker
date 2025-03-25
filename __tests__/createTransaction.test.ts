import { CreateTransaction } from '../app/(dashboard)/_actions/transactions';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst: jest.fn()
    },
    transation: {
      create: jest.fn().mockResolvedValue({ id: 'transaction123' })
    },
    monthHistory: {
      upsert: jest.fn().mockResolvedValue({})
    },
    yearHistory: {
      upsert: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn().mockImplementation(async (operations) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      if (typeof operations === 'function') {
        return operations(prisma);
      }
      return null;
    })
  }
}));

jest.mock('@clerk/nextjs/server', () => ({
  currentUser: jest.fn()
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}));

describe('CreateTransaction', () => {
  const mockUser = { id: 'user123' };
  const mockTransaction = {
    amount: 100,
    category: 'Food',
    date: new Date(),
    description: 'Groceries',
    type: 'expense' as 'expense' | 'income',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (currentUser as jest.Mock).mockResolvedValue(mockUser);
  });

  it('should create a new transaction', async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({ name: 'Food', icon: '🍔' });
    
    const result = await CreateTransaction(mockTransaction);

    // Check if $transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Check if revalidatePath was called
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    
    // Check if the result is correct
    expect(result).toEqual({ success: true });
  });

  it('should throw an error if category is not found', async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(CreateTransaction(mockTransaction)).rejects.toThrow('Category not found');
  });
});