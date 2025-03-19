interface RetryOptions {
  maxRetries: number;
  timeout: number;
  backoff?: (retryCount: number) => number;
}

interface RetryResult<T> {
  result: T;
  retryCount: number;
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<{ result: T; retryCount: number }> {
  const { maxRetries, timeout, backoff = (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000) } = options;
  let retryCount = 0;
  let lastError: Error | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeout}ms`));
    }, timeout);
  });

  while (retryCount <= maxRetries) {
    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return { result, retryCount };
    } catch (error) {
      lastError = error as Error;
      retryCount++;

      if (retryCount > maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoff(retryCount)));
    }
  }

  throw new Error(
    `Failed after ${retryCount} retries. Last error: ${lastError?.message || 'Unknown error'}`
  );
} 