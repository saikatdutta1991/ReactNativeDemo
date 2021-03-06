/** import modules section */
import React from 'react';
import { StyleSheet, ActivityIndicator, View, BackHandler, ImageBackground, Dimensions } from 'react-native';
import { Container, Text, Thumbnail, Icon, Button, Left, Right, Header, Body, Title } from 'native-base';
import customColor from '../../../../native-base-theme/variables/customColor';
import authuser from "../../../AuthUser";
import Socket from "../../../Socket";
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import gStorage from "../../../GInmemStorage";
import MatIcon from "react-native-vector-icons/MaterialIcons";
import { StackActions, NavigationActions } from 'react-navigation';


/** define constants and variables section */
const callBackImage = require('../../../images/phone_call_background.png');
const SEND_CALL = 'SEND_CALL';
const RECEIVE_CALL = 'RECEIVE_CALL';
const ONGOIN_CALL = 'ONGOIN_CALL';
const TIMEOUT = 30;
const CONNECT_TIMEOUT = 30;
const configuration = { "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] };


/** main SendCall Component */
export default class SendCall extends React.Component {

    /** initializing instance members */
    socket; peerConnection; localStream; remoteStream; iceCandidates = [];
    timeTick = 0; sendRequestTimer;
    connectCalleeTimeTick = 0; connectCalleeTimer;
    isConnected = false;
    //isRinging = false; isAccepted = false; isRejected = false; isCallEnded = false;
    state = {};
    calluniqueid;


    generateUniqueId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    };


    constructor(props) {
        super(props);
        this.onFocusSubscription = this.props.navigation.addListener('willFocus', this._onFocus);
    }



    componentDidMount() {
        console.log('SendCall::componentDidMount()');
        this.socket = Socket.instance(authuser.getId());
    }


    componentWillUnmount() {
        console.log('SendCall::componentWillUnmount()');
        this.onFocusSubscription.remove();
        this._resetAllStates();
    }


    /** this method gets called when navigated to this activity screen each time */
    _onFocus = async () => {
        console.log('SendCall::_onFocus()');
        // this.localStream = await this.getUserMedia(true, 30, true);
        // this.setState({ localStreamURL: this.localStream.toURL(), view_type: ONGOIN_CALL })
        // return;

        /** add socket events listeners */
        this.socket.on('is_connected_vc', this._isConnectedHandler);
        this.socket.on('vc_rejected', this._handleRejectCall);
        this.socket.on('vc_accepted', this._handleAccptedCall);
        this.socket.on('video-offer', this._handleVideoOffer);
        this.socket.on('video-answer', this._handleVideoAnswer);
        this.socket.on('vc_ended', this._handleVideoCallEnded);

        /** register backpress button handler */
        BackHandler.addEventListener('hardwareBackPress', this._handleBackPress);



        /** update the state data for caller and callee and await */
        await this.setState({
            view_type: this.props.navigation.getParam('view_type'),
            callee: this.props.navigation.getParam('callee'),
            caller: this.props.navigation.getParam('caller'),
            is_caller: this.props.navigation.getParam('is_caller')
        });

        /** view type is SEND_CALL then, try to connect to callee and ringging */
        switch (this.state.view_type) {
            case SEND_CALL:
                this._connectCallee();
                break;

            case RECEIVE_CALL:
                await this.setState({ call_status_text: 'Incomming call..' });
                InCallManager.startRingtone('_BUNDLE_');
                break;
        }

    }


    /** dont let the screen go back by back button */
    _handleBackPress() {
        return true;
    }




    /** try to connect callee, send push and open callee app also, 
     * run this connect callee for CONNECT_TIMEOUT
     */
    _connectCallee() {

        /** generate unique call id */
        this.calluniqueid = this.generateUniqueId();

        /** set state to connecting */
        this.setState({ call_status_text: 'Connecting..' });

        this.connectCalleeTimeTick = 0;
        this.connectCalleeTimer = setInterval(() => {

            /** stop connect callee timer on timeout */
            if (this.connectCalleeTimeTick++ >= CONNECT_TIMEOUT) {
                this.setState({ call_status_text: 'Connection timeout..' });
                return this._resetAllStatesAndGoback();
            }

            let isPushmsgNeeded = this.connectCalleeTimeTick === 1;

            this.socket.emit('connect_callee', {
                isPushmsgNeeded: isPushmsgNeeded,
                calleeId: this.state.callee._id,
                callerName: this.state.caller.name
            }, (isCalleeConnected) => {

                /** if callee connected to server, stop timer */
                if (isCalleeConnected) {
                    this._sendRingingEvents();
                    return clearInterval(this.connectCalleeTimer);
                }

            });


        }, 1000);

    }



    /** this method keeps sendind ringing event to calee untill timeout, or accept or reject */
    _sendRingingEvents() {

        InCallManager.start({ media: 'video', ringback: '_BUNDLE_' });

        this.setState({ call_status_text: 'Ringing..' });

        this.timeTick = 0;
        this.sendRequestTimer = setInterval(() => {

            /** when ringing timeout, send end call event */
            if (this.timeTick++ >= TIMEOUT) {
                this.socket.emit('end_vc', { callerId: this.state.caller._id, calleeId: this.state.callee._id });
            }

            this.socket.emit('send_vc', {
                callid: this.calluniqueid,
                calleeType: 'user',
                calleeId: this.state.callee._id,
                callerId: this.state.caller._id,
                callerName: this.state.caller.name,
                callerImageurl: this.state.caller.image_url
            });

        }, 1000);

    }




    /** reset all states and go back */
    _resetAllStatesAndGoback() {
        this._resetAllStates();
        gStorage.currentChatUser = this.state.is_caller ? this.state.callee : this.state.caller;

        setTimeout(() => {

            const resetAction = StackActions.reset({
                index: 0,
                actions: [NavigationActions.navigate({ routeName: 'Chat' })],
            });
            this.props.navigation.dispatch(resetAction);

        }, 1000);
    }






    _resetAllStates() {

        this.calluniqueid = '';

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        clearInterval(this.connectCalleeTimer);
        clearInterval(this.sendRequestTimer);

        /** remove socket listeners */
        this.socket.off('is_connected_vc', this._isConnectedHandler);
        this.socket.off('vc_rejected', this._handleRejectCall);
        this.socket.off('vc_accepted', this._handleAccptedCall);
        this.socket.off('video-offer', this._handleVideoOffer);
        this.socket.off('video-answer', this._handleVideoAnswer);
        this.socket.off('vc_ended', this._handleVideoCallEnded);

        /** remove back button handler */
        BackHandler.removeEventListener('hardwareBackPress', this._handleBackPress);

        InCallManager.stopRingtone();
        InCallManager.stopRingback();
        InCallManager.stop();

    }




    _handleVideoCallEnded = () => {
        console.log('SendCall::_handleVideoCallEnded()s')
        this.setState({ call_status_text: 'Call ended..' });
        this._resetAllStatesAndGoback();
    }



    _handleAddStreamEvent = async (event) => {
        console.log('_handleAddStreamEvent')
        this.remoteStream = event.stream;
        await this.setState({ remoteStreamURL: this.remoteStream.toURL() })
    }




    _handleICECandidateEvent = (event) => {

        if (event.candidate) {
            console.log('ice candidate collecting')
            this.iceCandidates.push(event.candidate);
        } else {
            console.log('ice candidate collected')
            if (this.iceCandidates.length) {

                if (this.state.is_caller) {

                    this.socket.emit('vc_exchange', {
                        usertype: 'user',
                        userid: this.state.callee._id,
                        mtype: 'video-offer',
                        candidates: this.iceCandidates,
                        sdp: this.peerConnection.localDescription
                    });

                } else {

                    this.socket.emit('vc_exchange', {
                        usertype: 'user',
                        userid: this.state.caller._id,
                        mtype: 'video-answer',
                        candidates: this.iceCandidates,
                        sdp: this.peerConnection.localDescription
                    });

                }

            }

        }


    }


    _handleVideoAnswer = (data) => {

        let desc = new RTCSessionDescription(data.sdp);
        this.peerConnection.setRemoteDescription(desc);

        data.candidates.forEach(candidate => {

            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch((err) => {
                    console.log('_handleNewICECandidate', err)
                })

        });

    }



    _handleVideoOffer = async (data) => {

        this.peerConnection = this.createPeerConnection();

        let desc = new RTCSessionDescription(data.sdp);

        await this.peerConnection.setRemoteDescription(desc);
        this.peerConnection.addStream(this.localStream);

        let answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        data.candidates.forEach(candidate => {

            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch((err) => {
                    console.log('_handleNewICECandidate', err)
                })

        });

    }




    _handleAccptedCall = async () => {

        InCallManager.stopRingback();

        this.setState({ call_status_text: 'Call accepted' });
        clearInterval(this.sendRequestTimer);

        this.peerConnection = this.createPeerConnection();

        this.localStream = await this.getUserMedia(true, 30, true);
        this.setState({ localStreamURL: this.localStream.toURL(), view_type: ONGOIN_CALL });
        this.peerConnection.addStream(this.localStream);


        let offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

    }


    /** handle call rejected by callee */
    _handleRejectCall = () => {
        this.setState({ call_status_text: 'Call rejected' });
        this._resetAllStatesAndGoback();
    }


    /** when calee press accept call button*/
    _handleAcceptCallButtonPress = async () => {
        this.socket.emit('accept_vc', { callerType: 'user', callerId: this.state.caller._id })
        this.setState({ view_type: ONGOIN_CALL });
        this.localStream = await this.getUserMedia(true, 30, true);
        this.setState({ localStreamURL: this.localStream.toURL(), view_type: ONGOIN_CALL });
        InCallManager.stopRingtone();
    }

    /** when callee press reject call button */
    _handleRejectCallButtonPress = () => {
        this.socket.emit('reject_vc', { callerType: 'user', callerId: this.state.caller._id });
        this.setState({ call_status_text: 'Call rejected' });
        this._resetAllStatesAndGoback();

    }


    /** 
     * when user presses cancel sending call button
     * cancel manually timers
     */
    _handleSendCallCancelButtonPress = () => {

        clearInterval(this.connectCalleeTimer);
        clearInterval(this.sendRequestTimer);
        this.socket.emit('end_vc', { callerId: this.state.caller._id, calleeId: this.state.callee._id });

    }



    /**
     * when user pressed end call button
     */
    _handleEndCallButton = () => {
        this.socket.emit('end_vc', { callerId: this.state.caller._id, calleeId: this.state.callee._id });
        this.setState({ call_status_text: 'Call ended' });
        this._resetAllStatesAndGoback();
    }





    _renderOngoingCall = () => {
        return (
            <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>

                {/* <View style={{ flexDirection: 'row', zIndex: 2, position: 'absolute' }}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={{ color: 'white' }}>Connecting..</Text>
                </View> */}

                {/* <Thumbnail source={callBackImage}
                    style={{ width: 200, height: 200, borderRadius: 100, marginBottom: 15, borderWidth: 10, borderColor: 'white' }}
                /> */}

                <RTCView streamURL={this.state.remoteStreamURL}
                    objectFit="cover"
                    style={{
                        width: Dimensions.get('window').width,
                        height: Dimensions.get('window').height,
                        zIndex: 1
                    }}
                />

                <View style={{
                    borderWidth: 1,
                    borderColor: "white",
                    width: 102,
                    height: 132,
                    backgroundColor: 'black',
                    position: 'absolute',
                    zIndex: 2,
                    right: 15,
                    top: 15,
                }}>
                    {/* <Thumbnail source={callBackImage}
                        style={{ width: 100, height: 130 }}
                    /> */}
                    <RTCView streamURL={this.state.localStreamURL}
                        objectFit="cover"
                        style={{
                            width: 100,
                            height: 130,
                        }}
                    />
                </View>

                <View style={{
                    flex: 1,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    position: 'absolute',
                    bottom: 0, width: '100%',
                    padding: 15,
                    zIndex: 2
                }}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', flexDirection: 'row' }}>
                        <MatIcon name="message" color="white" size={27}
                            style={{ backgroundColor: 'transparent', marginRight: 30, paddingTop: 15, paddingBottom: 15 }}
                        />
                        <MatIcon name="mic-off" color="white" size={27}
                            style={{ backgroundColor: 'transparent', marginRight: 30, paddingTop: 15, paddingBottom: 15 }}
                        />
                    </View>
                    <View>
                        <MatIcon name="call-end" color="white" size={27}
                            style={{ backgroundColor: 'red', padding: 15, borderRadius: 100 }}
                            onPress={this._handleEndCallButton}
                        />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'flex-start', flexDirection: 'row' }}>
                        <MatIcon name="videocam-off" color="white" size={27} type="MaterialIcons"
                            style={{ backgroundColor: 'transparent', marginLeft: 30, paddingTop: 15, paddingBottom: 15 }}
                        />
                        <MatIcon name="switch-camera" color="white" size={27} type="MaterialIcons"
                            style={{ backgroundColor: 'transparent', marginLeft: 30, paddingTop: 15, paddingBottom: 15 }}
                        />
                    </View>

                </View>
            </View >
        );
    }


    render() {

        if (this.state.view_type == SEND_CALL) {
            return this._sendCallRender();
        } else if (this.state.view_type == RECEIVE_CALL) {
            return this._inComingCallRender();
        } else {
            return this._renderOngoingCall();
        }

    }


    _sendCallRender() {
        return (
            <Container style={{ backgroundColor: '#ff5722b8' }}>
                <ImageBackground source={callBackImage} style={{ width: '100%', height: '100%' }}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white', marginBottom: 50 }}>You Are Calling</Text>
                        <Thumbnail source={{ uri: this.state.callee.image_url }}
                            style={{ width: 200, height: 200, borderRadius: 100, marginBottom: 15, borderWidth: 10, borderColor: 'white' }}
                        />
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 15 }}>{this.state.callee.name}</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <ActivityIndicator size="small" color="white" />
                            <Text style={{ color: 'white' }}>{this.state.call_status_text}</Text>
                        </View>
                    </View>
                    <View style={{ position: 'absolute', bottom: 0, width: '100%', padding: 15 }}>
                        <Button block style={{ backgroundColor: 'red' }}
                            onPress={this._handleSendCallCancelButtonPress}
                        >
                            <MatIcon name="call-end" color="white" size={27} />
                        </Button>
                    </View>
                </ImageBackground>
            </Container >
        );
    }


    _inComingCallRender() {
        return (
            <Container style={{ backgroundColor: '#ff5722b8' }}>
                <ImageBackground source={callBackImage} style={{ width: '100%', height: '100%' }}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white', marginBottom: 50 }}>New Incoming Call</Text>
                        <Thumbnail source={{ uri: this.state.caller.image_url }}
                            style={{ width: 200, height: 200, borderRadius: 100, marginBottom: 15, borderWidth: 10, borderColor: 'white' }}
                        />
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 15 }}>{this.state.caller.name}</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <ActivityIndicator size="small" color="white" />
                            <Text style={{ color: 'white' }}>{this.state.call_status_text}</Text>
                        </View>
                    </View>
                    <View style={{ position: 'absolute', bottom: 0, width: '100%', padding: 15, flexDirection: 'row', justifyContent: 'center' }}>
                        <Button onPress={this._handleRejectCallButtonPress} block style={{ backgroundColor: 'red', justifyContent: 'center', flex: 1, marginRight: 15 }}>
                            <MatIcon name="call-end" color="white" size={27} />
                        </Button>
                        <Button onPress={this._handleAcceptCallButtonPress} block style={{ backgroundColor: 'green', justifyContent: 'center', flex: 1, marginLeft: 15 }}>
                            <MatIcon name="call" color="white" size={27} />
                        </Button>
                    </View>
                </ImageBackground>
            </Container >
        );
    }



    /** cerate new peer connection and add event listeners 
     * returns peerconnection object
     */
    createPeerConnection() {

        myPeerConnection = new RTCPeerConnection(configuration);
        myPeerConnection.onicecandidate = this._handleICECandidateEvent;
        myPeerConnection.onaddstream = this._handleAddStreamEvent;

        // myPeerConnection.ontrack = handleTrackEvent;
        // myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
        // myPeerConnection.onremovetrack = handleRemoveTrackEvent;
        // myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
        // myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
        // myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;

        return myPeerConnection;
    }



    async getUserMedia(isAudio = true, minFrameRate = 50, isFront = true) {

        let videoSourceId;
        let deviceSources = await mediaDevices.enumerateDevices();

        deviceSources.forEach(deviceInfo => {
            if (deviceInfo.kind == "video" && deviceInfo.facing == (isFront ? "front" : "back")) {
                videoSourceId = deviceInfo.id;
            }
        });


        return mediaDevices.getUserMedia({
            audio: isAudio,
            video: {
                mandatory: {
                    width: { min: 1024, ideal: 1280, max: 1920 },
                    height: { min: 576, ideal: 720, max: 1080 },
                    minFrameRate: minFrameRate
                },
                facingMode: (isFront ? "user" : "environment"),
                optional: (videoSourceId ? [{ sourceId: videoSourceId }] : [])
            }
        });

    }






}

const styles = StyleSheet.create({
    statusText: {
        color: customColor.brandPrimary,
        fontSize: 25
    },
    container: {
        backgroundColor: customColor.brandLight
    },
    thumbnail: {
        width: 200,
        height: 200,
        marginBottom: 50,
        borderRadius: 100,
        borderWidth: 5,
        borderColor: customColor.brandPrimary
    }
});