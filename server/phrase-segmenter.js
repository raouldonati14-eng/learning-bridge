export class PhraseSegmenter {
  constructor({stabilityThreshold=0.85,minWords=4,reserveWords=3}={}){this.stabilityThreshold=stabilityThreshold;this.minWords=minWords;this.reserveWords=reserveWords;this.committedWords=0;}
  push({text='',isFinal=false,stability=0}){
    const words=text.trim().split(/\s+/).filter(Boolean);if(!words.length)return[];
    if(isFinal){const phrase=words.slice(Math.min(this.committedWords,words.length)).join(' ');this.reset();return phrase?[{text:phrase,source:'final'}]:[];}
    if(stability<this.stabilityThreshold)return[];
    const hasBoundary=/[.!?;:]$/.test(text.trim()),safeEnd=hasBoundary?words.length:Math.max(0,words.length-this.reserveWords),available=safeEnd-this.committedWords;
    if(available<this.minWords)return[];
    const phrase=words.slice(this.committedWords,safeEnd).join(' ');this.committedWords=safeEnd;return[{text:phrase,source:'stable-interim'}];
  }
  reset(){this.committedWords=0;}
}
