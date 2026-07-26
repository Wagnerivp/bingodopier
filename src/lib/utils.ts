import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate Bingo Card Numbers
export function generateBingoCard() {
  const card: number[][] = [[], [], [], [], []];
  const minMax = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  for (let col = 0; col < 5; col++) {
    const [min, max] = minMax[col];
    const columnNumbers = new Set<number>();
    while (columnNumbers.size < 5) {
      if (col === 2 && columnNumbers.size === 2) {
        // Free space in the middle, represented by 0 or special flag, let's use 0
        columnNumbers.add(0);
      } else {
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        if (num !== 0) { // ensure no 0 generated accidentally
          columnNumbers.add(num);
        }
      }
    }
    card[col] = Array.from(columnNumbers).sort((a, b) => {
       if (a === 0) return 0; // Keep 0 wherever it falls during sort, actually we want it exactly in middle
       if (b === 0) return 0;
       return a - b;
    });
    // Force 0 to be at index 2 for the 3rd column
    if (col === 2) {
      card[col] = card[col].filter(n => n !== 0);
      card[col].splice(2, 0, 0);
    }
  }

  // Transpose to get rows
  const rows: number[][] = [[], [], [], [], []];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      rows[i].push(card[j][i]);
    }
  }
  return rows;
}
