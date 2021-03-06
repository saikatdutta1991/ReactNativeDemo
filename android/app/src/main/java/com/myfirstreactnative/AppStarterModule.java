package com.myfirstreactnative;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.myfirstreactnative.MainActivity;
import com.facebook.react.bridge.ReactMethod;
import android.content.Intent;
import com.myfirstreactnative.ForeGroundService;
import android.os.Build;

class AppStarterModule extends ReactContextBaseJavaModule {

    AppStarterModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "AppStarter";
    }

    @ReactMethod
    void start() {
        ReactApplicationContext context = getReactApplicationContext();
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }


    @ReactMethod
    void startMyForegroundService() {
        ReactApplicationContext context = getReactApplicationContext();
        Intent intent = new Intent(context, ForeGroundService.class);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.startForegroundService(intent);
        else
            context.startService(intent);

        
    }


}