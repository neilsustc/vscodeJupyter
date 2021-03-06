import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import 'socket.io-client';
import * as ResultActions from '../../actions/results';
import Header from '../../components/Header';
import ResultList from '../../components/ResultList';
import { RootState } from '../../reducers';

interface AppProps {
    settings: NotebookResultSettings;
    resultActions: typeof ResultActions;
    results: NotebookResultsState;
};

interface AppState {
    /* empty */
}

class App extends React.Component<AppProps, AppState>{
    private socket: SocketIOClient.Socket;

    constructor(props?: AppProps, context?: any) {
        super(props, context);

        // Use io (object) available in the script
        this.socket = (window as any).io();
        this.socket.on('connect', () => {
            // Do nothing
        });

        this.socket.on('clientExists', (data: any) => {
            this.socket.emit('clientExists', { id: data.id });
        });

        this.socket.on('results', (value: NotebookOutput[]) => {
            if (!this.props.settings.appendResults) {
                this.props.resultActions.clearResults();
            }
            this.socket.emit('results.ack');
            this.props.resultActions.addResults(value);

            let resultsList = document.getElementById('viewport');
            resultsList.scrollTop = resultsList.scrollHeight;
        });

        this.socket.on('clearClientResults', () => {
            this.props.resultActions.clearResults();
        });

        this.socket.on('setClientAppendResults', value => {
            this.props.resultActions.setAppendResults(value);
        });
    }

    private styles: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'auto'
    }

    render() {
        const { children, results } = this.props;
        return (
            <div id={'viewport'} style={this.styles}>
                <ResultList results={results}></ResultList>
                {children}
            </div>
        );
    }
}

function mapStateToProps(state: RootState) {
    return {
        settings: state.settings,
        results: state.results
    };
}

function mapDispatchToProps(dispatch) {
    return {
        resultActions: bindActionCreators(ResultActions as any, dispatch)
    };
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(App);
