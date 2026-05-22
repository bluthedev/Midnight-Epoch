export class StateMachine {
    private initialState: string;
    private possibleStates: { [key: string]: State };
    private stateArgs: any[];
    public state: string | null;

    constructor(initialState: string, possibleStates: { [key: string]: State }, stateArgs: any[] = []) {
        this.initialState = initialState;
        this.possibleStates = possibleStates;
        this.stateArgs = stateArgs;
        this.state = null;

        for (const state of Object.values(this.possibleStates)) {
            state.stateMachine = this;
        }
    }

    step() {
        if (this.state === null) {
            this.state = this.initialState;
            this.possibleStates[this.state].enter(...this.stateArgs);
        }

        this.possibleStates[this.state].execute(...this.stateArgs);
    }

    transition(newState: string, ...enterArgs: any[]) {
        this.state = newState;
        this.possibleStates[this.state].enter(...this.stateArgs, ...enterArgs);
    }
}

export class State {
    public stateMachine!: StateMachine;
    enter(..._args: any[]) {}
    execute(..._args: any[]) {}
}
