export default class RollManager {
    constructor(initialRolls = {}) {
        this.rolls = { ...initialRolls };
        this.counts = {};
    }

    resetCounts() {
        this.counts = {};
        return this;
    }

    clearAll() {
        this.rolls = {};
        this.counts = {};
        return this;
    }

    getCount(group) {
        return this.counts[group] || 0;
    }

    cloneCounts() {
        return { ...this.counts };
    }

    restoreCounts(counts) {
        this.counts = { ...counts };
        return this;
    }

    getRoll(group, matches = null) {
        const idx = this.getCount(group);
        this.counts[group] = idx + 1;
        const key = `${group}_${idx}`;

        if (matches && matches.length > 0) {
            if (!this.rolls[key] || !matches.includes(this.rolls[key])) {
                this.rolls[key] = matches[Math.floor(Math.random() * matches.length)];
            }
        }
        return this.rolls[key];
    }

    peekRoll(group, index) {
        return this.rolls[`${group}_${index}`];
    }

    deleteRoll(group, index) {
        delete this.rolls[`${group}_${index}`];
    }
}