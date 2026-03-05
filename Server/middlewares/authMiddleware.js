export const protect = async (req, res, next) => {
    try {
        const { userId } = await req.auth();
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Attach userId to request for downstream use
        req.userId = userId;
        return next();
    } catch (error) {
        console.log('Auth middleware error:', error);
        return res.status(401).json({ error: 'Unauthorized', details: error.message });
    }
}