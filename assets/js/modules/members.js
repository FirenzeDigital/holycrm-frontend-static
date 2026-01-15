// Generated module: Members
class MembersModule {
    constructor() {
        this.moduleKey = "members";
        this.name = "Members";
        this.collection = "members";
    }
    
    async fetchData(pb, churchId) {
        return await pb.collection('members').getList(1, 50, {
            filter: `church = "${churchId}"`
        });
    }
}

// Register module
if (window.ModuleRegistry) {
    const module = new MembersModule();
    window.ModuleRegistry.registerModule(module);
}