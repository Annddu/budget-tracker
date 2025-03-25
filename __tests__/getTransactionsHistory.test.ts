import { getTransactionsHistory } from '../app/api/transactions-history/route';
import { prisma } from '@/lib/prisma';
import { GetFormatterForCurrency } from '@/lib/helpers';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: {
      findUnique: jest.fn()
    },
    transation: {
      findMany: jest.fn()
    }
  }
}));

jest.mock('@/lib/helpers', () => ({
  GetFormatterForCurrency: jest.fn()
}));

describe('getTransactionsHistory', () => {
  const userId = 'user123';
  const from = new Date('2023-01-01');
  const to = new Date('2023-01-31');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter transactions by date range', async () => {
    const mockSettings = { userId, currency: 'USD' };
    const mockFormatter = { format: (amount: number) => `$${amount}` }; 
    const mockTransactions = [
      { 
        id: '1', 
        amount: 100, 
        date: new Date('2023-01-15'),
        type: 'expense', 
        description: 'Test expense',
        category: 'Food',
        categoryIcon: '🍔',
        userId
      },
      { 
        id: '2', 
        amount: 200, 
        date: new Date('2023-01-20'),
        type: 'income', 
        description: 'Test income',
        category: 'Salary',
        categoryIcon: '💰',
        userId
      }
    ];

    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue(mockSettings);
    (GetFormatterForCurrency as jest.Mock).mockReturnValue(mockFormatter);
    (prisma.transation.findMany as jest.Mock).mockResolvedValue(mockTransactions);

    const result = await getTransactionsHistory(userId, from, to);

    expect(prisma.transation.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        date: { gte: from, lte: to }
      },
      orderBy: { date: 'desc' }
    });
    
    expect(result).toHaveLength(2);
    expect(result[0].formattedAmount).toBe('$100');
    expect(result[1].formattedAmount).toBe('$200');
  });

  it('should return empty array if no transactions found', async () => {
    const mockSettings = { userId, currency: 'USD' };
    const mockFormatter = { format: (amount: number) => `$${amount}` };

    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue(mockSettings);
    (GetFormatterForCurrency as jest.Mock).mockReturnValue(mockFormatter);
    (prisma.transation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getTransactionsHistory(userId, from, to);
    
    expect(result).toEqual([]);
  });
});