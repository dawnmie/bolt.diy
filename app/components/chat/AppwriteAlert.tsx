import { AnimatePresence, motion } from 'framer-motion';
import type { AppwriteAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { appwriteConnection } from '~/lib/stores/appwrite';
import { useStore } from '@nanostores/react';
import { useState, useEffect } from 'react';
import { PlatformType, sdk } from 'appbuild-oceanbase-console';

interface Props {
  alert: AppwriteAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export function AppwriteChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { content } = alert;
  const connection = useStore(appwriteConnection);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Determine connection state
  const isConnected = !!(connection.endpoint && connection.sessionToken && connection.selectedProjectId);

  // Set title and description based on connection state
  const title = isConnected ? 'Appwrite Collection' : 'Appwrite Connection Required';
  const description = isConnected ? 'Create database collection' : 'Appwrite connection required';
  const message = isConnected
    ? 'Please review the proposed changes and apply them to your database.'
    : 'Please connect to Appwrite to continue with this operation.';

  const handleConnectClick = () => {
    // Dispatch an event to open the Appwrite connection dialog
    document.dispatchEvent(new CustomEvent('open-appwrite-connection'));
  };

  // Determine if we should show the Connect button or Apply Changes button
  const showConnectButton = !isConnected;

  const executeAppwriteAction = async (migrationData: string) => {
    if (!connection.endpoint || !connection.sessionToken || !connection.selectedProjectId) {
      postMessage(`*Error: Appwrite connection required. Please connect to Appwrite first.*`);
      return;
    }

    // Use content from alert if migrationData is empty
    const dataToUse = migrationData || content || '';

    if (!dataToUse) {
      postMessage(`*Error: No migration data available. Please check the action content.*`);
      return;
    }

    console.log('Executing Appwrite action:', {
      hasMigrationData: !!migrationData,
      hasContent: !!content,
      dataLength: dataToUse.length,
    });

    setIsExecuting(true);

    try {
      // Configure SDK endpoint to use shared login state
      sdk.forConsole.client.setEndpoint(connection.endpoint);

      await sdk.forConsole.projects.createPlatform({
        projectId: connection.selectedProjectId,
        type: PlatformType.Web,
        name: 'Web',
        hostname: '*',
      });

      const region = '';
      const projectSdk = sdk.forProject(region, connection.selectedProjectId);

      // Must set endpoint BEFORE making any API calls
      projectSdk.client.setEndpoint(connection.endpoint);

      const schema: any = {
        databaseId: 'default',
        collections: JSON.parse(dataToUse),
      };

      console.log('Schema data:', schema);

      const databases = await projectSdk.tablesDB.list();
      const defaultDatabase = databases.databases.find((db: any) => db.name === 'default');

      if (!defaultDatabase) {
        projectSdk.tablesDB.create({ databaseId: 'default', name: 'default' });
      }

      const migration = projectSdk.schemaMigration;
      const plan = await migration.generatePlan(schema);

      plan.operations.forEach((op, i) => {
        console.log(`   ${i + 1}. ${op.type}: ${op.reason}`);
      });

      if (plan.operations.length === 0) {
        postMessage('*Success: Database is already in sync with the schema. No changes needed.*');
        clearAlert();

        return;
      }

      await migration.execute(plan, schema, { dryRun: true });

      await migration.execute(plan, schema);

      postMessage(`*Success: Migration completed successfully! ${plan.operations.length} operation(s) applied.*`);
      clearAlert();
    } catch (error: any) {
      console.error('Appwrite schema migration operation failed:', error);

      const errorMessage = error?.message || 'Unknown error occurred';
      postMessage(`*Error: Appwrite schema migration operation failed: ${errorMessage}*`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Component to format migration content
  function MigrationContentFormatter({ content }: { content: string }) {
    const [formatted, setFormatted] = useState<string>('');

    useEffect(() => {
      const formatContent = async () => {
        if (!content) {
          setFormatted('');
          return;
        }

        try {
          // Parse as JSON
          const parsed = JSON.parse(content);
          setFormatted(JSON.stringify(parsed, null, 2));
        } catch {
          // Fallback to raw content if JSON parsing fails
          setFormatted(content);
        }
      };

      formatContent();
    }, [content]);

    return <pre>{formatted || content}</pre>;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="max-w-chat rounded-lg border-l-2 border-l-[#F02E65] border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <img height="10" width="18" crossOrigin="anonymous" src="https://cdn.simpleicons.org/appwrite" />
            <h3 className="text-sm font-medium text-[#F02E65]">{title}</h3>
          </div>
        </div>

        {/* Migration Content */}
        <div className="px-4">
          {!isConnected ? (
            <div className="p-3 rounded-md bg-bolt-elements-background-depth-3">
              <span className="text-sm text-bolt-elements-textPrimary">
                You must first connect to Appwrite and select a project.
              </span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center p-2 rounded-md bg-bolt-elements-background-depth-3 cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <div className="i-ph:database text-bolt-elements-textPrimary mr-2"></div>
                <span className="text-sm text-bolt-elements-textPrimary flex-grow">
                  {description || 'Create collection'}
                </span>
                <div
                  className={`i-ph:caret-up text-bolt-elements-textPrimary transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                ></div>
              </div>

              {!isCollapsed && content && (
                <div className="mt-2 p-3 bg-bolt-elements-background-depth-4 rounded-md overflow-auto max-h-60 font-mono text-xs text-bolt-elements-textSecondary">
                  <MigrationContentFormatter content={content} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Message and Actions */}
        <div className="p-4">
          <p className="text-sm text-bolt-elements-textSecondary mb-4">{message}</p>

          <div className="flex gap-2">
            {showConnectButton ? (
              <button
                onClick={handleConnectClick}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#F02E65]',
                  'hover:bg-[#D02655]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Connect to Appwrite
              </button>
            ) : (
              <button
                onClick={() => executeAppwriteAction(content)}
                disabled={isExecuting}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#F02E65]',
                  'hover:bg-[#D02655]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500',
                  'text-white',
                  'flex items-center gap-1.5',
                  isExecuting ? 'opacity-70 cursor-not-allowed' : '',
                )}
              >
                {isExecuting ? 'Applying...' : 'Apply Changes'}
              </button>
            )}
            <button
              onClick={clearAlert}
              disabled={isExecuting}
              className={classNames(
                `px-3 py-2 rounded-md text-sm font-medium`,
                'bg-[#503B26]',
                'hover:bg-[#774f28]',
                'focus:outline-none',
                'text-[#F79007]',
                isExecuting ? 'opacity-70 cursor-not-allowed' : '',
              )}
            >
              Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
