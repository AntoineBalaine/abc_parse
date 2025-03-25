export interface Rational {
  numerator: number;
  denominator: number;
}

// Helper functions for rational number operations
export function createRational(numerator: number, denominator: number = 1): Rational {
  if (denominator === 0 && numerator === 0) {
    return { numerator: 0, denominator: 1 }; // Convert 0/0 to 0/1
  }

  if (denominator === 0) {
    return { numerator: numerator > 0 ? 1 : -1, denominator: 0 }; // Represent infinity with sign
  }

  // Ensure proper sign handling (keep negative in numerator)
  if (denominator < 0) {
    numerator = -numerator;
    denominator = -denominator;
  }

  // Simplify the fraction
  const gcd = findGCD(Math.abs(numerator), denominator);
  return {
    numerator: Math.floor(numerator / gcd),
    denominator: Math.floor(denominator / gcd),
  };
}

// Greatest Common Divisor using Euclidean algorithm
export function findGCD(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  return b === 0 ? a : findGCD(b, a % b);
}

// Basic arithmetic operations
export function addRational(a: Rational, b: Rational): Rational {
  // Handle infinity cases
  if (a.denominator === 0 || b.denominator === 0) {
    return createRational(1, 0); // Infinity
  }

  return createRational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export function subtractRational(a: Rational, b: Rational): Rational {
  return addRational(a, createRational(-b.numerator, b.denominator));
}

export function multiplyRational(a: Rational, b: Rational): Rational {
  return createRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divideRational(a: Rational, b: Rational): Rational {
  // Division by zero results in infinity with appropriate sign
  if (b.numerator === 0) {
    return createRational(a.numerator >= 0 ? 1 : -1, 0);
  }

  return createRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

// Convert to number (for compatibility with existing code)
export function rationalToNumber(r: Rational): number {
  if (r.denominator === 0) {
    return r.numerator > 0 ? Infinity : -Infinity;
  }
  return r.numerator / r.denominator;
}

// Convert to string representation
export function rationalToString(r: Rational): string {
  if (r.denominator === 0) {
    return r.numerator >= 0 ? "Infinity" : "-Infinity";
  }
  return `${r.numerator}/${r.denominator}`;
}

// Compare two rationals
export function compareRational(a: Rational, b: Rational): number {
  // Handle infinity cases
  if (a.denominator === 0 && b.denominator === 0) {
    return Math.sign(a.numerator) - Math.sign(b.numerator); // Compare signs of infinity
  }
  if (a.denominator === 0) return a.numerator > 0 ? 1 : -1; // a is infinity
  if (b.denominator === 0) return b.numerator > 0 ? -1 : 1; // b is infinity

  // Regular comparison: a/b ⋛ c/d ⟺ ad ⋛ bc
  const diff = a.numerator * b.denominator - b.numerator * a.denominator;
  return Math.sign(diff);
}

// Check if a rational represents infinity
export function isInfiniteRational(r: Rational): boolean {
  return r.denominator === 0;
}

// Check if two rationals are equal
export function equalRational(a: Rational, b: Rational): boolean {
  return compareRational(a, b) === 0;
}

// Create a rational from a floating-point number (approximate)
export function rationalFromNumber(num: number, maxDenominator: number = 10000): Rational {
  if (!isFinite(num)) {
    return createRational(num > 0 ? 1 : -1, 0); // Handle infinity
  }

  if (num === 0) {
    return createRational(0, 1);
  }

  // For simple fractions, try to find exact representation
  if (Number.isInteger(num)) {
    return createRational(num, 1);
  }

  // For simple fractions like 0.5, 0.25, etc.
  const str = num.toString();
  if (str.includes(".")) {
    const decimalPart = str.split(".")[1];
    if (decimalPart.length <= 6) {
      // Only try for reasonably short decimals
      const denominator = Math.pow(10, decimalPart.length);
      const numerator = Math.round(num * denominator);
      return createRational(numerator, denominator);
    }
  }

  // For more complex fractions, use continued fraction approximation
  let sign = 1;
  if (num < 0) {
    sign = -1;
    num = -num;
  }

  let n = 0;
  let d = 1;
  let n1 = 1;
  let d1 = 0;
  let a = Math.floor(num);

  while (true) {
    n = a * n1 + n;
    d = a * d1 + d;

    if (d > maxDenominator) {
      break;
    }

    const diff = num - n / d;
    if (Math.abs(diff) < 1e-10) {
      break;
    }

    num = 1 / (num - a);
    if (!isFinite(num)) {
      break;
    }

    a = Math.floor(num);

    const tempN = n;
    const tempD = d;
    n = n1;
    d = d1;
    n1 = tempN;
    d1 = tempD;
  }

  return createRational(sign * n, d);
}
