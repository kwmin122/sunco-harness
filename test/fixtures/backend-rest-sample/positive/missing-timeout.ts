// Phase 51 fixture — missing-timeout POSITIVE case.
// fetch() without AbortSignal or timeout option.

export async function loadUserProfile(userId: string) {
  const res = await fetch(`https://api.example.com/users/${userId}`);
  return res.json();
}

export async function fetchPosts() {
  const res = await fetch('https://api.example.com/posts');
  return res.json();
}
