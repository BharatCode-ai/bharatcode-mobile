import {fireEvent,render,waitFor} from '@testing-library/react-native';
import ConversationScreen from './ConversationScreen';
import {StoreProvider} from '../../state/react';
import {AppStore} from '../../state/app-store';
import {ConversationStore,MemoryDatabase} from '../../storage/conversation-store';
const mockRouter={push:jest.fn(),replace:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>({id:'ses_checkout'})}));
jest.mock('@expo/vector-icons',()=>({Ionicons:()=>null}));
jest.mock('react-native-safe-area-context',()=>({...jest.requireActual('react-native-safe-area-context'),useSafeAreaInsets:()=>({top:0,right:0,bottom:0,left:0})}));
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn(async()=>{}),getStringAsync:jest.fn(async()=>'context')}));
test('the visible composer sends its current text and renders the sample reply',async()=>{
 const store=new AppStore({persistence:new ConversationStore(new MemoryDatabase()),credentials:{get:async()=>undefined,set:async()=>{},remove:async()=>{}}});await store.enterPreview();
 const screen=await render(<StoreProvider store={store}><ConversationScreen/></StoreProvider>);await waitFor(()=>expect(store.getSnapshot().conversationReady).toBe(true));
 await fireEvent.changeText(screen.getByLabelText('Message BharatCode'),'Run the sample checks');await fireEvent.press(screen.getByLabelText('Send message'));
 await waitFor(()=>expect(screen.getByText('Run the sample checks')).toBeTruthy());expect(store.getSnapshot().draft).toBe('');expect(screen.getByText(/This is a sample workspace/)).toBeTruthy();expect(screen.getByLabelText('View working changes')).toBeTruthy();
 await screen.unmount();store.dispose();
});
