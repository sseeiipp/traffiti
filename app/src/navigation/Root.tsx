import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRef } from 'react';
import { useMyCrews } from '../api/hooks';
import * as A from '../screens/account';
import * as Cal from '../screens/calendar';
import * as Cr from '../screens/create';
import * as Crew from '../screens/crew';
import * as H from '../screens/home';
import * as Ob from '../screens/onboard';
import * as O from '../screens/onboarding';
import * as People from '../screens/people';
import * as R from '../screens/results';
import * as Run from '../screens/run';
import { useAuth } from '../store/auth';
import { useRun } from '../store/run';
import { Loading } from '../ui/kit';
import { TabBar } from './TabBar';
import type { Stack as S, Tabs as TT } from './types';

const Stack = createNativeStackNavigator<S>();
const Tab = createBottomTabNavigator<TT>();

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Tab.Screen name="Home" component={H.Home} />
      <Tab.Screen name="CrewResult" component={R.CrewResult} />
      <Tab.Screen name="Calendar" component={Cal.Calendar} />
      <Tab.Screen name="Gallery" component={R.Gallery} />
    </Tab.Navigator>
  );
}

const sheet = { presentation: 'transparentModal' as const, animation: 'fade' as const };

export function Root() {
  const { hydrated, accessToken, introSeen } = useAuth();
  const crews = useMyCrews();
  // 앱을 열었을 때 끝나지 않은 러닝이 있으면 복구 화면부터
  const recover = useRef(!!useRun.getState().session?.runId).current;

  if (!hydrated || (accessToken && crews.isLoading)) return <Loading />;
  const hasCrew = (crews.data?.crews.length ?? 0) > 0;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      {!accessToken ? (
        <Stack.Group>
          {!introSeen ? <Stack.Screen name="Onboard" component={Ob.Onboard} /> : null}
          {!introSeen ? <Stack.Screen name="Intro" component={O.Intro} /> : null}
          <Stack.Screen name="AuthStart" component={O.AuthStart} />
          <Stack.Screen name="Login" component={O.Login} />
          <Stack.Screen name="Terms" component={O.Terms} />
          <Stack.Screen name="TermsDetail" component={O.TermsDetail} />
          <Stack.Screen name="Signup" component={O.Signup} />
          <Stack.Screen name="PasswordReset" component={O.PasswordReset} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          {recover ? <Stack.Screen name="Recovery" component={Run.Recovery} /> : null}
          {!hasCrew ? <Stack.Screen name="CrewSetup" component={O.CrewSetup} /> : null}
          <Stack.Screen name="Tabs" component={MainTabs} />
          {hasCrew ? <Stack.Screen name="CrewSetup" component={O.CrewSetup} /> : null}
          <Stack.Screen name="LocationNeeded" component={O.LocationNeeded} options={sheet} />
          <Stack.Screen name="MySettings" component={A.MySettings} />
          <Stack.Screen name="ProfileEdit" component={A.ProfileEdit} options={{ presentation: 'modal' }} />
          <Stack.Screen name="PrivacyScope" component={A.PrivacyScope} />
          <Stack.Screen name="AccountDelete" component={A.AccountDelete} />
          <Stack.Screen name="PasswordReset" component={O.PasswordReset} />
          <Stack.Screen name="CrewSwitcher" component={H.CrewSwitcher} options={{ presentation: 'modal' }} />
          <Stack.Screen name="CreateMethod" component={Cr.CreateMethod} />
          <Stack.Screen name="CourseSelect" component={Cr.CourseSelect} />
          <Stack.Screen name="DrawMap" component={Cr.DrawMap} />
          <Stack.Screen name="Sketchbook" component={Cr.Sketchbook} />
          <Stack.Screen name="AreaPick" component={Cr.AreaPick} />
          <Stack.Screen name="RouteReview" component={Cr.RouteReview} />
          <Stack.Screen name="ChallengeShare" component={Cr.ChallengeShare} />
          <Stack.Screen name="FriendRun" component={Cr.FriendRun} />
          <Stack.Screen name="FriendToCrew" component={Cr.FriendToCrew} />
          <Stack.Screen name="FriendRunExpired" component={Cr.FriendRunExpired} />
          <Stack.Screen name="ChallengeJoin" component={Run.ChallengeJoin} />
          <Stack.Screen name="Running" component={Run.Running} options={{ gestureEnabled: false }} />
          {!recover ? <Stack.Screen name="Recovery" component={Run.Recovery} /> : null}
          <Stack.Screen name="RunSaved" component={Run.RunSaved} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CustomCategory" component={Run.CustomCategory} />
          <Stack.Screen name="CrewRanking" component={R.CrewRanking} />
          <Stack.Screen name="CrewProfile" component={R.CrewProfile} />
          <Stack.Screen name="Artwork" component={R.Artwork} />
          <Stack.Screen name="ShareSheet" component={R.ShareSheet} options={sheet} />
          <Stack.Screen name="ShapeBook" component={R.ShapeBook} />
          <Stack.Screen name="ChallengeStop" component={R.ChallengeStop} options={sheet} />
          <Stack.Screen name="RunDetail" component={Cal.RunDetail} />
          <Stack.Screen name="CrewManage" component={Crew.CrewManage} />
          <Stack.Screen name="CrewEdit" component={Crew.CrewEdit} options={{ presentation: 'modal' }} />
          <Stack.Screen name="CrewMembers" component={Crew.CrewMembers} />
          <Stack.Screen name="CrewInvite" component={Crew.CrewInvite} />
          <Stack.Screen name="UserSearch" component={People.UserSearch} />
          <Stack.Screen name="UserProfile" component={People.UserProfile} />
          <Stack.Screen name="CrewLeave" component={Crew.CrewLeave} options={sheet} />
          <Stack.Screen name="CrewSettings" component={Crew.CrewSettings} />
          <Stack.Screen name="CrewLevel" component={Crew.CrewLevel} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
