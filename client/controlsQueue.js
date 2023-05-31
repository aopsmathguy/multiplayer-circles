var ControlsQueue = class {
    listeners;
    controlsQueue;
    start;
    end;
    constructor() {
        this.listeners = {};
        this.controlsQueue = {};
        this.start = 0;
        this.end = 0;
    }
    addEventListener(type, f) {
        if (!this.listeners[type]) {
            this.listeners[type] = []
        }
        this.listeners[type].push(f)
    }
    handleEvent(type, e) {
        var listeners = this.listeners[type]
        if (listeners) {
            for (var i = 0; i < listeners.length; i++) {
                listeners[i](e);
            }
        }
    }
    addEvent(type, e, timeAct) {
        this.controlsQueue[this.end++] = {
            type: type,
            e: e,
            timeAct: timeAct
        }
    }
    removeEvents(cutoffTime) {
        for (var i = this.start; i < this.end; i++) {
            var time = this.controlsQueue[i].timeAct;
            if (time < cutoffTime) {
                delete this.controlsQueue[i];
                this.start++
            } else {
                break;
            }
        }
    }
    handleEvents(timeNow, dt) {
        for (var i = this.start; i < this.end; i++) {
            var time = this.controlsQueue[i].timeAct;
            if (time < timeNow && time >= timeNow - dt) {
                this.handleEvent(this.controlsQueue[i].type, this.controlsQueue[i].e)
                // console.log(this.controlsQueue[i].type)
            }

        }
    }
}