export function advancePastUnavailable(sequence,unavailable){let next=sequence;while(unavailable.delete(next))next++;return next;}
export function retryBlockedSegment({segment,pending,nextSequence}){pending.set(segment.sequence,segment);return Math.min(nextSequence,segment.sequence);}
