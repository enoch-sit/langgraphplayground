"""Quick test to verify StateManager refactoring works correctly."""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_imports():
    """Test that all imports work."""
    print("Testing imports...")
    
    try:
        from src.agent.state_manager import StateManager, GraphRunner, create_state_manager
        print("✅ StateManager imports successful")
    except Exception as e:
        print(f"❌ StateManager import failed: {e}")
        return False
    
    try:
        from src.agent.graph import graph
        print("✅ Graph import successful")
    except Exception as e:
        print(f"❌ Graph import failed: {e}")
        return False
    
    return True


def test_state_manager_creation():
    """Test StateManager creation."""
    print("\nTesting StateManager creation...")
    
    try:
        from src.agent.state_manager import create_state_manager
        from src.agent.graph import graph
        
        # Create a state manager
        sm = create_state_manager(graph, "test-thread-123")
        print(f"✅ StateManager created: {sm}")
        print(f"   - Thread ID: {sm.thread_id}")
        print(f"   - Config: {sm.config}")
        
        return True
    except Exception as e:
        print(f"❌ StateManager creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_state_manager_methods():
    """Test StateManager methods."""
    print("\nTesting StateManager methods...")
    
    try:
        from src.agent.state_manager import create_state_manager
        from src.agent.graph import graph
        from langchain_core.messages import HumanMessage
        
        # Create a state manager
        sm = create_state_manager(graph, "test-thread-456")
        
        # Test get_current_state
        state = sm.get_current_state()
        print(f"✅ get_current_state() works")
        print(f"   - State values: {list(state.values.keys()) if state.values else 'None'}")
        
        # Test get_display_info
        info = sm.get_display_info()
        print(f"✅ get_display_info() works")
        print(f"   - Keys: {list(info.keys())}")
        
        # Test message serialization
        test_msg = HumanMessage(content="Test message")
        serialized = sm._serialize_message(test_msg)
        print(f"✅ _serialize_message() works")
        print(f"   - Serialized: {serialized}")
        
        # Test message deserialization
        msg_dicts = [{"type": "HumanMessage", "content": "Hello"}]
        deserialized = sm.deserialize_messages(msg_dicts)
        print(f"✅ deserialize_messages() works")
        print(f"   - Deserialized: {deserialized}")
        
        return True
    except Exception as e:
        print(f"❌ StateManager methods failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_webapp_imports():
    """Test webapp imports with StateManager."""
    print("\nTesting webapp imports...")
    
    try:
        from src.agent.webapp import app
        print("✅ webapp imports successful (with StateManager)")
        
        # Check that StateManager is imported
        import src.agent.webapp as webapp_module
        if hasattr(webapp_module, 'create_state_manager'):
            print("✅ create_state_manager available in webapp")
        else:
            print("⚠️  create_state_manager not directly exposed (this is OK)")
        
        return True
    except Exception as e:
        print(f"❌ webapp import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("StateManager Refactoring Verification")
    print("=" * 60)
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("StateManager Creation", test_state_manager_creation()))
    results.append(("StateManager Methods", test_state_manager_methods()))
    results.append(("Webapp Integration", test_webapp_imports()))
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name:30s} {status}")
    
    all_passed = all(passed for _, passed in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed! StateManager refactoring is working correctly.")
        print("\nNext steps:")
        print("1. Start backend: python -m src.agent.webapp")
        print("2. Test endpoints: curl http://localhost:2024/threads/test/state/fields")
        print("3. Review STATE_MANAGER_GUIDE.md for usage examples")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
    print("=" * 60)


if __name__ == "__main__":
    main()
