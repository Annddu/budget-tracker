// app/context/DemoContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

type DemoContextType = {
  isDemoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
};

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const queryClient = useQueryClient();

  const enableDemoMode = () => {
    setIsDemoMode(true);
    generateAllDemoData();
  };

  const disableDemoMode = () => {
    setIsDemoMode(false);
    // Invalidate all cached data to restore from the server
    queryClient.invalidateQueries();
  };

  // Generate random data for all visualizations
  const generateAllDemoData = () => {
    // Generate history data (for charts)
    generateRandomHistoryData();
    
    // Generate transactions data (for table)
    generateRandomTransactionsData();
    
    // Generate overview data (for dashboard cards)
    generateRandomOverviewData();
  };

  // Random history data for charts
  const generateRandomHistoryData = () => {
    // Monthly data
    const monthlyData = [];
    const daysInMonth = 31; // Maximum possible
    
    for (let day = 1; day <= daysInMonth; day++) {
      monthlyData.push({
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        day: day,
        income: Math.random() * 5000,
        expense: Math.random() * 3000
      });
    }
    
    // Yearly data
    const yearlyData = [];
    for (let month = 0; month < 12; month++) {
      yearlyData.push({
        year: new Date().getFullYear(),
        month: month,
        income: Math.random() * 15000,
        expense: Math.random() * 10000
      });
    }
    
    // Set the data in the query cache
    queryClient.setQueryData(
      ["overview", "history", "month"],
      monthlyData
    );
    
    queryClient.setQueryData(
      ["overview", "history", "year"],
      yearlyData
    );
  };

  // Random transactions for the table
  const generateRandomTransactionsData = () => {
    const categories = [
      { name: "Food", icon: "🍔" },
      { name: "Transportation", icon: "🚗" },
      { name: "Entertainment", icon: "🎬" },
      { name: "Shopping", icon: "🛍️" },
      { name: "Health", icon: "🏥" },
      { name: "Education", icon: "📚" },
      { name: "Salary", icon: "💰" },
      { name: "Investment", icon: "📈" }
    ];
    
    const transactions = Array.from({ length: 50 }, (_, i) => {
      const isExpense = Math.random() > 0.3;
      const category = categories[Math.floor(Math.random() * (isExpense ? 6 : 2) + (isExpense ? 0 : 6))];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      return {
        id: `demo-${i}`,
        amount: Math.floor(Math.random() * (isExpense ? 500 : 5000) + 10),
        formattedAmount: isExpense ? `-$${Math.floor(Math.random() * 500 + 10)}` : `$${Math.floor(Math.random() * 5000 + 1000)}`,
        type: isExpense ? "expense" : "income",
        category: category.name,
        categoryIcon: category.icon,
        description: isExpense 
          ? ["Groceries", "Lunch", "Dinner", "Coffee", "Bus ticket", "Movie tickets"][Math.floor(Math.random() * 6)]
          : ["Monthly salary", "Freelance work", "Dividend", "Bonus"][Math.floor(Math.random() * 4)],
        date: date
      };
    });
    
    // Sort by date, newest first
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Add to cache for any date range query
    queryClient.setQueryData(
      ["transactions"],
      transactions
    );
  };

  // Random overview data for dashboard cards
  const generateRandomOverviewData = () => {
    const overview = {
      totalIncome: Math.floor(Math.random() * 20000 + 5000),
      totalExpense: Math.floor(Math.random() * 15000 + 2000),
      balance: Math.floor(Math.random() * 10000),
      categories: [
        { name: "Food", percentage: 30, amount: 1500 },
        { name: "Transportation", percentage: 20, amount: 1000 },
        { name: "Entertainment", percentage: 15, amount: 750 },
        { name: "Shopping", percentage: 25, amount: 1250 },
        { name: "Other", percentage: 10, amount: 500 }
      ]
    };
    
    queryClient.setQueryData(["overview"], overview);
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, enableDemoMode, disableDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoProvider");
  }
  return context;
}