// Phase 51 frontend-web-sample — minimal interactions, bounce easing reinforced in JS animation.
document.querySelectorAll('.bouncy-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.animate(
      [{ transform: 'scale(1.0)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1.0)' }],
      { duration: 400, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
    );
  });
});
