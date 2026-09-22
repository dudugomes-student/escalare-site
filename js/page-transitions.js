// Native multipage navigation remains in charge. Skipping a visual transition is normal.
for (const name of ['pageswap', 'pagereveal']) {
  addEventListener(name, event => {
    const transition = event.viewTransition;
    if (!transition) return;
    // ready rejects when navigation/visibility changes cancel the optional animation.
    transition.ready.catch(() => {});
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) transition.skipTransition();
  });
}
