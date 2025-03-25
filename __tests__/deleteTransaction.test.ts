import { DeleteTransaction } from '../app/(dashboard)/_actions/deleteTransaction';
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
    transation: {
      findUnique: jest.fn(), // Changed from findFirst to findUnique
      delete: jest.fn().mockResolvedValue({ id: 'transaction123' })
    },
    monthHistory: {
      update: jest.fn().mockResolvedValue({}), // Changed from updateMany to update
      updateMany: jest.fn().mockResolvedValue({}) // Keep this for backward compatibility
    },
    yearHistory: {
      update: jest.fn().mockResolvedValue({}), // Changed from updateMany to update
      updateMany: jest.fn().mockResolvedValue({}) // Keep this for backward compatibility
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

describe('DeleteTransaction', () => {
  const mockUser = { id: 'user123' };
  const transactionId = 'transaction123';

  beforeEach(() => {
    jest.clearAllMocks();
    (currentUser as jest.Mock).mockResolvedValue(mockUser);
  });

  it('should delete an existing transaction', async () => {
    // Setup mocks
    const mockTransaction = { 
      id: transactionId, 
      amount: 100,
      userId: mockUser.id,
      date: new Date('2023-01-15'),
      type: 'expense' as 'expense' | 'income'
    };
    
    (prisma.transation.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
    
    const result = await DeleteTransaction(transactionId);

    // Check if findUnique was called to get the transaction
    expect(prisma.transation.findUnique).toHaveBeenCalledWith({
      where: {
        id: transactionId,
        userId: mockUser.id,
      }
    });
    
    // Check if $transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Check if the result is correct
    expect(result).toEqual({ success: true });
  });

  it('should throw an error if transaction is not found', async () => {
    (prisma.transation.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(DeleteTransaction(transactionId)).rejects.toThrow('Transaction not found');
  });
});