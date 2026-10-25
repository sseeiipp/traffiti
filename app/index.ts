import { registerRootComponent } from 'expo';

import App from './App';
// 화면이 꺼져도 러닝 위치를 받는 작업은 앱이 뜰 때 정의해 둬야 한다
import './src/run/background';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
