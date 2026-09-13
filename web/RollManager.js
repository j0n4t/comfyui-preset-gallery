export default class RollManager {
    /** @param {Record<string, string>} initialRolls */
    constructor(initialRolls = {}) {
        this.rolls = { ...initialRolls };
        /** @type {Record<string, number>} */
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

    /** @param {string} group */
    getCount(group) {
        return this.counts[group] || 0;
    }

    cloneCounts() {
        return { ...this.counts };
    }

    /** @param {Record<string, number>} counts  */
    restoreCounts(counts) {
        this.counts = { ...counts };
        return this;
    }

    /**
     * @param {string} group
     * @param {string[]} matches
     */
    getRoll(group, matches) {
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

    /**
     * @param {string} group
     * @param {number} index
     */
    peekRoll(group, index) {
        return this.rolls[`${group}_${index}`];
    }

    /**
     * @param {string} group
     * @param {number} index
     */
    deleteRoll(group, index) {
        delete this.rolls[`${group}_${index}`];
    }
}