import { UpdateTransaction } from '../app/(dashboard)/_actions/updateTransaction';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// Mock console.error to suppress expected error messages
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst: jest.fn()
    },
    transation: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'transaction123', amount: 150 })
    },
    monthHistory: {
      updateMany: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({})
    },
    yearHistory: {
      updateMany: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn().mockImplementation(async (operations) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      if (typeof operations === 'function') {
        return operations(prisma);
      }
      return { id: 'transaction123', amount: 150 };
    })
  }
}));

jest.mock('@clerk/nextjs/server', () => ({
  currentUser: jest.fn()
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}));

describe('UpdateTransaction', () => {
  const mockUser = { id: 'user123' };
  const mockTransaction = {
    id: 'transaction123',
    amount: 150,
    category: 'Food',
    date: new Date(),
    description: 'Updated Groceries',
    type: 'expense' as 'expense' | 'income',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (currentUser as jest.Mock).mockResolvedValue(mockUser);
  });

  it('should update an existing transaction', async () => {
    // Setup mocks
    const originalTransaction = { 
      ...mockTransaction, 
      amount: 100,
      userId: mockUser.id,
      date: new Date('2023-01-15')
    };
    
    (prisma.transation.findFirst as jest.Mock).mockResolvedValue(originalTransaction);
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({ name: 'Food', icon: '🍔' });
    
    const result = await UpdateTransaction(mockTransaction);

    // Check if findFirst was called to get the original transaction
    expect(prisma.transation.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockTransaction.id,
        userId: mockUser.id,
      }
    });
    
    // Check if $transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Check if the result is correct
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('transaction');
    expect(result).toHaveProperty('timestamp');
  });

  it('should throw an error if transaction is not found', async () => {
    (prisma.transation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(UpdateTransaction(mockTransaction)).rejects.toThrow('Transaction not found');
  });

  it('should throw an error if category is not found', async () => {
    (prisma.transation.findFirst as jest.Mock).mockResolvedValue({
      ...mockTransaction,
      userId: mockUser.id
    });
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(UpdateTransaction(mockTransaction)).rejects.toThrow('Category not found');
  });
});