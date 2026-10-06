export const FEEDBACK_MOTIONS = {
  sway: [{ rotate: '0deg' }, { rotate: '-16deg', offset: .3 }, { rotate: '10deg', offset: .65 }, { rotate: '0deg' }],
  spin: [{ rotate: '0deg' }, { rotate: '360deg' }],
  stamp: [{ scale: 1 }, { scale: 1.35, offset: .25 }, { scale: .8, offset: .55 }, { scale: 1 }],
  glide: [{ translate: '0 0' }, { translate: '9px -4px', offset: .45 }, { translate: '-3px 2px', offset: .8 }, { translate: '0 0' }],
  lift: [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -9px', rotate: '-6deg', offset: .4 }, { translate: '0 0', rotate: '0deg' }],
};
