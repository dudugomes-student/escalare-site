const clamp = value => Math.min(1, Math.max(0, value));
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

const SCALE_STATES = [
  'A necessidade começa em um setor: um lugar dentro da operação.',
  'Períodos organizam a mesma necessidade no tempo.',
  'A presença profissional passa a ocupar uma posição compreensível.',
  'Setor, período e profissional formam um contexto.'
];

export function createHomeNarrative({ gsap, ScrollTrigger }) {
  const scaleStory = document.querySelector('[data-scale-story]');
  const scaleStage = scaleStory?.querySelector('.scale-stage');
  const scaleCopy = scaleStory?.querySelector('[data-scale-copy]');
  const activeCell = scaleStory?.querySelector('.scale-cell.is-active');
  const humanStory = document.querySelector('[data-human-story]');
  const humanFrame = humanStory?.querySelector('[data-human-frame]');
  const convergence = document.querySelector('[data-convergence]');
  const header = document.getElementById('siteHeader');
  const animations = [];
  const media = gsap.matchMedia();
  let scaleProgress = 1;
  let scaleStageIndex = -1;
  let disposed = false;

  function setScaleStage(index) {
    if (!scaleStory || index === scaleStageIndex) return;
    scaleStageIndex = index;
    scaleStory.dataset.stage = String(index + 1);
    if (scaleCopy) scaleCopy.textContent = SCALE_STATES[index];
    scaleStory.querySelectorAll('[data-scale-chapter]').forEach((chapter, chapterIndex) => {
      const current = chapterIndex === index;
      chapter.classList.toggle('is-current', current);
      if (current) chapter.setAttribute('aria-current', 'step');
      else chapter.removeAttribute('aria-current');
    });
  }

  function setScaleProgress(value) {
    if (!scaleStory || disposed) return;
    scaleProgress = clamp(value);
    const index = scaleProgress < .24 ? 0 : scaleProgress < .49 ? 1 : scaleProgress < .73 ? 2 : 3;
    setScaleStage(index);
    const relation = smooth(.67, .91, scaleProgress);
    const growth = smooth(.88, 1, scaleProgress);
    scaleStory.style.setProperty('--relation-offset', String(1 - relation));
    scaleStory.style.setProperty('--cell-scale', String(1 + growth * .16));
    if (activeCell) activeCell.style.setProperty('--cell-lift', `${growth * -4}px`);
  }

  if (scaleStory && scaleStage) {
    scaleStory.classList.add('is-narrative-enhanced');
    media.add('(min-width: 701px)', () => {
      const playhead = { progress: 0 };
      const tween = gsap.to(playhead, {
        progress: 1,
        ease: 'none',
        onUpdate: () => setScaleProgress(playhead.progress),
        scrollTrigger: {
          trigger: scaleStory,
          start: () => `top ${header?.offsetHeight || 0}px`,
          end: () => `+=${Math.max(innerHeight * 2.35, 1450)}`,
          pin: scaleStage,
          pinSpacing: true,
          scrub: .55,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => setScaleProgress(playhead.progress)
        }
      });
      animations.push(tween);
      setScaleProgress(0);
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        setScaleProgress(1);
      };
    });

    media.add('(max-width: 700px)', () => {
      setScaleProgress(1);
    });
  }

  if (humanStory && humanFrame) {
    const presence = humanFrame.querySelector('.human-presence');
    const grid = humanFrame.querySelector('.human-grid');
    const frameTween = gsap.fromTo(humanFrame,
      { clipPath: 'inset(28% 31% 28% 31%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
        scrollTrigger: {
          trigger: humanStory,
          start: 'top 88%',
          end: 'top 18%',
          scrub: .65,
          invalidateOnRefresh: true
        }
      }
    );
    animations.push(frameTween);

    if (presence) {
      const presenceTween = gsap.fromTo(presence,
        { scale: .22, transformOrigin: '50% 52%' },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: humanStory,
            start: 'top 86%',
            end: 'top 24%',
            scrub: .65
          }
        }
      );
      animations.push(presenceTween);
    }

    if (grid) {
      const gridTween = gsap.fromTo(grid,
        { scale: 1.22, opacity: .8, transformOrigin: '50% 50%' },
        {
          scale: 1,
          opacity: .45,
          ease: 'none',
          scrollTrigger: {
            trigger: humanStory,
            start: 'top 88%',
            end: 'top 20%',
            scrub: .65
          }
        }
      );
      animations.push(gridTween);
    }
  }

  if (convergence) {
    const cells = [...convergence.querySelectorAll('.convergence-cell')];
    const field = convergence.querySelector('.convergence-field');
    const origins = [
      { xPercent: -65, yPercent: -45 },
      { xPercent: 48, yPercent: -70 },
      { xPercent: -82, yPercent: 58 },
      { xPercent: 68, yPercent: 46 },
      { xPercent: 26, yPercent: -95 }
    ];
    cells.forEach((cell, index) => {
      const tween = gsap.fromTo(cell,
        { ...origins[index], opacity: index === 4 ? .2 : .42 },
        {
          xPercent: 0,
          yPercent: 0,
          opacity: index === 4 ? .45 : 1,
          ease: 'none',
          scrollTrigger: {
            trigger: convergence,
            start: 'top 92%',
            end: 'top 22%',
            scrub: .75
          }
        }
      );
      animations.push(tween);
    });

    if (field) {
      const fieldTween = gsap.fromTo(field,
        { opacity: 1 },
        {
          opacity: .75,
          ease: 'none',
          scrollTrigger: {
            trigger: convergence,
            start: 'top 92%',
            end: 'top 18%',
            scrub: .75
          }
        }
      );
      animations.push(fieldTween);
    }
  }

  ScrollTrigger.refresh();

  if (scaleStory) {
    scaleStory.getScaleDiagnostics = () => ({
      stage: scaleStageIndex + 1,
      progress: scaleProgress,
      pinned: matchMedia('(min-width: 701px)').matches
    });
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      media.revert();
      animations.forEach(animation => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });
      if (scaleStory) {
        scaleStory.classList.remove('is-narrative-enhanced');
        scaleStory.dataset.stage = '4';
        scaleStory.style.removeProperty('--relation-offset');
        scaleStory.style.removeProperty('--cell-scale');
        delete scaleStory.getScaleDiagnostics;
      }
      activeCell?.style.removeProperty('--cell-lift');
      const humanElements = [humanFrame, humanFrame?.querySelector('.human-presence'), humanFrame?.querySelector('.human-grid')].filter(Boolean);
      if (humanElements.length) gsap.set(humanElements, { clearProps: 'all' });
      const convergenceCells = convergence ? convergence.querySelectorAll('.convergence-cell') : [];
      if (convergenceCells.length) gsap.set(convergenceCells, { clearProps: 'all' });
      const convergenceField = convergence?.querySelector('.convergence-field');
      if (convergenceField) gsap.set(convergenceField, { clearProps: 'all' });
    }
  };
}
