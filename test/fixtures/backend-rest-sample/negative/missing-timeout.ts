// Phase 51 fixture — missing-timeout NEGATIVE case.
// fetch() with AbortSignal.timeout() providing explicit timeout.

export async function loadUserProfile(userId: string) {
  const res = await fetch(`https://api.example.com/users/${userId}`, {
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}

export async function fetchPosts() {
  const res = await fetch('https://api.example.com/posts', {
    signal: AbortSignal.timeout(3000),
  });
  return res.json();
}
