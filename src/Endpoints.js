const endpoints = {};
endpoints.socket = 'https://connectbuddy.herokuapp.com?type=user&id=';
endpoints.base = 'https://connectbuddy.herokuapp.com';
endpoints.register = endpoints.base + '/api/v1/user/register';
endpoints.login = endpoints.base + '/api/v1/user/login';
endpoints.getProfile = endpoints.base + '/api/v1/user/profile';
endpoints.updateProfile = endpoints.base + '/api/v1/user/profile';
endpoints.getNearbyUsers = endpoints.base + '/api/v1/user/nearby';
endpoints.sendFriendRequest = endpoints.base + '/api/v1/user/requests/send';
endpoints.getFriendRequests = endpoints.base + '/api/v1/user/requests';
endpoints.cancelFriendRequest = endpoints.base + '/api/v1/user/requests/cancel';
endpoints.rejectFriendRequest = endpoints.base + '/api/v1/user/requests/reject';
endpoints.acceptFriendRequest = endpoints.base + '/api/v1/user/requests/accept';
endpoints.getFriends = endpoints.base + '/api/v1/user/friends';
endpoints.getMessages = endpoints.base + '/api/v1/user/friends/:userid/messages'; //replace with :userid
endpoints.addDeviceToken = endpoints.base + '/api/v1/user/fcm/token';
endpoints.getUserImage = endpoints.base + '/api/v1/user/:userid/image';
module.exports = endpoints;