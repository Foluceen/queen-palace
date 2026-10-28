/**
 * Sets <html data-motion="none|essential|full"> before first paint, so CSS can prepare
 * the hero entrance without a flash, and so everything agrees on one motion tier.
 * Mirrors motionTier() in src/lib/motion/anime.ts.
 */
const script = `(function(){try{var d=document.documentElement,n=navigator,c=n.connection||{};var t='full';if(matchMedia('(prefers-reduced-motion: reduce)').matches)t='none';else if(c.saveData||/(^|-)2g$/.test(c.effectiveType||'')||(n.deviceMemory&&n.deviceMemory<2)||(n.hardwareConcurrency&&n.hardwareConcurrency<4))t='essential';d.dataset.motion=t}catch(e){}})();`;

export function MotionTierScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
