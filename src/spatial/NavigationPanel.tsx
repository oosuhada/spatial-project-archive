import { Accessibility, Compass, GalleryHorizontal, Keyboard, MousePointer2, Route } from 'lucide-react';

export function NavigationPanel({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="panel-stack navigation-panel">
      <section><Compass size={18} /><div><strong>Free explore</strong><p>Drag to orbit, right-drag to move laterally, and scroll or pinch to dolly. Camera range is bounded to the exhibition room.</p></div></section>
      <section><MousePointer2 size={18} /><div><strong>Artifact jump</strong><p>Select any visible artifact or use Search. Selection is preserved in the URL so the same exhibit can be reopened directly.</p></div></section>
      <section><Route size={18} /><div><strong>Guided tour</strong><p>Use the timeline arrows or Start tour. Only positions marked as camera stops are included in authored exhibition versions.</p></div></section>
      <section><Keyboard size={18} /><div><strong>Keyboard</strong><p>Left / Right steps through the story, Escape closes the primary overlay, and Tab stays trapped inside an open drawer or sheet until it closes.</p></div></section>
      <section><GalleryHorizontal size={18} /><div><strong>Skip spatial mode</strong><p>The 2D gallery contains the same artifacts, metadata, relationships, search targets, and curator citations. Mobile defaults to this mode.</p></div></section>
      <section><Accessibility size={18} /><div><strong>Motion preference</strong><p>{reducedMotion ? 'Reduced motion is active: camera transitions and ambient movement are minimized.' : 'Your system currently allows motion. Reduced-motion preferences are respected automatically.'}</p></div></section>
    </div>
  );
}

