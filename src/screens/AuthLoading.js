import React from 'react';
import { StyleSheet, Image, ProgressBarAndroid } from 'react-native';
import { Container, Text } from 'native-base';
import authuser from "../AuthUser";
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid } from 'react-native';
import gStorage from "../GInmemStorage";
import customColor from '../../native-base-theme/variables/customColor';
import firebase from 'react-native-firebase';
import Services from "../Services";
import Socket from "../Socket";

export default class AuthLoading extends React.Component {

    constructor(props) {
        super(props);
        this.state = { loadingText: 'Loading ..' };
    }


    _requestLocationPermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)

            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            return false;
        }
    }


    _getCurrentPosition = async () => {

        return new Promise(function (resolve, reject) {

            Geolocation.getCurrentPosition(
                (position) => {
                    resolve(position);
                },
                (error) => {
                    reject(error)
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, showLocationDialog: true, distanceFilter: 0 }
            );
        })
    }



    async componentDidMount() {

        /** settings loaing text */
        this.setState({ loadingText: 'Checking Auth ..' });

        /** load authuser from asyncstorage */
        await authuser.load();

        /** check user is authenticated */
        if (!authuser.isAuthenticated()) {
            setTimeout(() => { this.props.navigation.navigate('Auth'); }, 1000)
            return;
        }


        this.socket = await Socket.instance(authuser.getId());


        /** make status for geolocation permisstion */
        this.setState({ loadingText: 'GeoLocation Permission ..' });

        /** if hasLocationPermission false, then ask again */
        let hasLocationPermission = false;
        while (!hasLocationPermission) {
            hasLocationPermission = await this._requestLocationPermission();
        }

        /** make status for current location fetching */
        this.setState({ loadingText: 'Fetching current location ..' });

        /** until current position is returning */
        let position;
        while (!position) {
            try {
                position = await this._getCurrentPosition();
            } catch (error) { }
        }

        /** store current posstion to global storage */
        gStorage.currentPosition = position;



        /** check firebase messaging permission until authorized */
        this.setState({ loadingText: 'Push messaging permission ..' });
        let enabled = await firebase.messaging().hasPermission();
        while (!enabled) {
            try {
                await firebase.messaging().requestPermission();
                enabled = true;
            } catch (error) {
                enabled = false;
            }
        }


        /** get device token from storage then 
         * if token is missing then get from firebase
         */
        if (!authuser.getDeviceToken()) {

            let fcmToken = '';
            while (!fcmToken) {
                fcmToken = await firebase.messaging().getToken();
            }

            /** update user device token to server */
            this.setState({ loadingText: 'Updating push token ..' });
            await Services.addDeviceToken(fcmToken);
            await authuser.setDeviceToken(fcmToken).save();

        }


        /** redirect to main app */
        setTimeout(() => { this.props.navigation.navigate('App'); }, 1000)

    }


    // Render any loading content that you like here
    render() {
        return (
            <Container style={styles.container}>
                <Image source={Services.getLogo()}
                    style={{ width: '100%', height: 100, resizeMode: "contain", marginBottom: 50, borderRadius: 100 }}
                />

                <ProgressBarAndroid styleAttr="Horizontal" color={customColor.brandPrimary}
                    style={{ width: 250, height: 15 }}
                />
                <Text style={{ color: customColor.brandPrimary, fontSize: 12 }}>{this.state.loadingText}</Text>
            </Container>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingRight: 15,
        paddingLeft: 15
    }
});