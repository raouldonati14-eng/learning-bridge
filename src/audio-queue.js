export function queueMetrics(items, now=Date.now()) {
  const queuedDurationMs=items.reduce((sum,item)=>sum+(item.durationMs||estimateDurationMs(item.spanish)),0);
  return {queuedSegments:items.length,queuedDurationMs,oldestAgeMs:items.length?Math.max(0,now-items[0].sentAt):0};
}
export function estimateDurationMs(text=''){return Math.max(700,(text.trim().split(/\s+/).filter(Boolean).length/2.7)*1000+250);}
export function playbackRateFor(metrics){if(metrics.queuedDurationMs>12_000)return 1.18;if(metrics.queuedDurationMs>6_000)return 1.1;return 1.05;}
export function recoveryPlan(items,now=Date.now()){
  const metrics=queueMetrics(items,now);if(metrics.oldestAgeMs<30_000||metrics.queuedDurationMs<20_000)return{play:items,skipped:[]};
  let duration=0,cut=items.length;for(let i=items.length-1;i>=0;i--){duration+=items[i].durationMs||estimateDurationMs(items[i].spanish);if(duration>12_000){cut=i+1;break;}cut=i;}
  return{skipped:items.slice(0,cut),play:items.slice(cut)};
}
