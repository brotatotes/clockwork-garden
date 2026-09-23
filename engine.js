/* Clockwork Garden. Original synthesis and sequencing, no external dependencies. */
(function (root) {
  'use strict';
  const NOTES = [48, 50, 52, 55, 57, 60, 62, 64];
  const SPECIES = {
    bell: {name: 'Bellflower', color: '#edc77c', rhythm: [0, 8], description: 'Two warm, chiming bells'},
    clover: {name: 'Copper Clover', color: '#e8a18a', rhythm: [0, 3, 6], description: 'Three dancing plucks'},
    reed: {name: 'Glass Reed', color: '#a5cfcb', rhythm: [0, 8], description: 'Two long, airy tones'},
    moss: {name: 'Velvet Moss', color: '#b9cd88', rhythm: [0, 4, 8, 12], description: 'Four soft bass pulses'}
  };
  const example = () => ({version: 1, tempo: 84, flowers: [
    {id: 1, species: 'moss', x: 0, y: 7}, {id: 2, species: 'bell', x: 2, y: 2},
    {id: 3, species: 'clover', x: 4, y: 4}, {id: 4, species: 'reed', x: 6, y: 5},
    {id: 5, species: 'bell', x: 10, y: 0}, {id: 6, species: 'clover', x: 12, y: 3}
  ], links: [{from: 2, to: 5}]});
  const midi = f => NOTES[7 - f.y] - (f.species === 'moss' ? 12 : 0);
  const noteName = f => ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][midi(f) % 12] + (Math.floor(midi(f) / 12) - 1);
  function eventsAt(garden, step) {
    const events = [];
    for (const flower of garden.flowers) {
      if (SPECIES[flower.species].rhythm.some(offset => (flower.x + offset) % 16 === step)) {
        events.push({flower, delay: 0, gain: 1, reply: false});
        const link = garden.links.find(l => l.from === flower.id);
        const target = link && garden.flowers.find(f => f.id === link.to);
        if (target) events.push({flower: target, delay: 1, gain: .38, reply: true});
      }
    }
    return events;
  }
  function validate(value) {
    if (!value || value.version !== 1 || !Number.isFinite(value.tempo) || value.tempo < 60 || value.tempo > 120 || !Array.isArray(value.flowers) || value.flowers.length > 16 || !Array.isArray(value.links) || value.links.length > 16) throw Error('This is not a supported garden.');
    const ids = new Set(), cells = new Set();
    const flowers = value.flowers.map(f => {
      if (!f || !Number.isSafeInteger(f.id) || f.id < 1 || f.id > 1000000 || typeof f.species !== 'string' || !Object.hasOwn(SPECIES, f.species) || !Number.isInteger(f.x) || f.x < 0 || f.x > 15 || !Number.isInteger(f.y) || f.y < 0 || f.y > 7 || ids.has(f.id) || cells.has(f.x + ',' + f.y)) throw Error('A flower has an invalid or repeated position.');
      ids.add(f.id); cells.add(f.x + ',' + f.y);
      return {id: f.id, species: f.species, x: f.x, y: f.y};
    });
    const sources = new Set();
    const links = value.links.map(l => {
      if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to || sources.has(l.from)) throw Error('A vine must connect two flowers, with one reply per source.');
      sources.add(l.from); return {from: l.from, to: l.to};
    });
    return {version: 1, tempo: value.tempo, flowers, links};
  }
  const MAX_TEXT = 12000;
  function parse(text) {
    if (typeof text !== 'string' || text.length > MAX_TEXT) throw Error('Garden data is too large. The limit is 12 KB.');
    try { return validate(JSON.parse(text)); }
    catch (error) { throw Error('Could not open this garden. ' + (error instanceof SyntaxError ? 'The JSON is incomplete or malformed.' : error.message)); }
  }
  const serialize = value => JSON.stringify(validate(value));
  function fragment(value) { return '#garden=' + btoa(serialize(value)); }
  function fromFragment(text) {
    if (typeof text !== 'string' || text.length > MAX_TEXT || !/^#garden=[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('This garden code is invalid or too large.');
    try { return parse(atob(text.slice(8))); }
    catch (error) { throw Error('Could not open this garden code. ' + error.message); }
  }
  function voice(ctx, out, flower, time, strength = 1) {
    const freq = 440 * Math.pow(2, (midi(flower) - 69) / 12);
    const type = flower.species;
    const duration = type === 'reed' ? 1.4 : type === 'bell' ? 1.1 : type === 'clover' ? .38 : .55;
    const amp = type === 'reed' ? .027 : type === 'moss' ? .052 : .04;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(amp * strength, time + (type === 'reed' ? .09 : .012));
    envelope.gain.exponentialRampToValueAtTime(.00001, time + duration);
    envelope.gain.setValueAtTime(0, time + duration + .02);
    envelope.connect(out);
    const components = type === 'bell' ? [[1, 1], [2, .24], [3, .07]] : type === 'reed' ? [[1, 1], [2, .22]] : [[1, 1]];
    let remaining = components.length;
    components.forEach(([ratio, level]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type === 'clover' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * ratio, time);
      gain.gain.value = level;
      osc.connect(gain); gain.connect(envelope); osc.start(time); osc.stop(time + duration + .03);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); if (--remaining === 0) envelope.disconnect(); };
    });
    return duration;
  }
  class Engine {
    constructor(getGarden, onPulse, onState) {
      this.getGarden = getGarden; this.onPulse = onPulse; this.onState = onState;
      this.running = false; this.volume = .65; this.queue = []; this.played = 0;
    }
    async play() {
      if (this.running || this.starting) return;
      const request=(this.request||0)+1;this.request=request;this.starting=true;
      try {
      if (!this.ctx) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) throw Error('Web Audio is unavailable in this browser. Try a current browser.');
        this.ctx = new Audio();
        this.master = this.ctx.createGain();
        this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048;
        this.master.connect(this.analyser); this.analyser.connect(this.ctx.destination);
        this.ctx.onstatechange = () => { if (this.ctx.state !== 'running' && this.running) this.pause(); };
      }
      await this.ctx.resume();
      if(this.request!==request)return;
      if (this.ctx.state !== 'running') throw Error('Audio could not start. Press play again.');
      this.bus = this.ctx.createGain(); this.bus.connect(this.master);
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.running = true; this.step = 0; this.next = this.ctx.currentTime + .06; this.queue = [];
      this.timer = setInterval(() => this.tick(), 25); this.tick(); this.onState(true);
      } finally {this.starting=false;}
    }
    setVolume(v) { this.volume = v; if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, .03); }
    tick() {
      if (!this.running) return;
      const now = this.ctx.currentTime;
      // A delayed timer drops the backlog, never schedules a catch-up burst.
      if (this.next < now - .1) this.next = now + .04;
      let guard = 0;
      while (this.next < now + .1 && guard++ < 2) {
        const g = this.getGarden(), eighth = 30 / g.tempo;
        for (const e of eventsAt(g, this.step)) {
          const time = this.next + e.delay * eighth;
          voice(this.ctx, this.bus, e.flower, time, e.gain);
          this.queue.push({time, id: e.flower.id, reply: e.reply}); this.played++;
        }
        this.queue.push({time: this.next, step: this.step});
        this.next += eighth; this.step = (this.step + 1) % 16;
      }
    }
    frame() {
      if (!this.running) return;
      const now = this.ctx.currentTime;
      const ready = this.queue.filter(e => e.time <= now);
      this.queue = this.queue.filter(e => e.time > now);
      for (const e of ready) this.onPulse(e);
    }
    pause() {
      this.request=(this.request||0)+1;
      if (!this.running) return;
      this.running = false; clearInterval(this.timer); this.queue = [];
      const old = this.bus, now = this.ctx.currentTime;
      old.gain.cancelScheduledValues(now); old.gain.setTargetAtTime(0, now, .012);
      setTimeout(() => old.disconnect(), 100);
      this.onState(false);
    }
  }
  const api = {NOTES, SPECIES, example, midi, noteName, eventsAt, validate, parse, serialize, fragment, fromFragment, MAX_TEXT, voice, Engine};
  if (typeof module !== 'undefined') module.exports = api;
  root.GardenMusic = api;
})(typeof window === 'undefined' ? globalThis : window);
