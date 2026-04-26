// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ChainPosts {
    uint256 public constant MAX_POST_LENGTH = 280;

    struct Post {
        uint256 id;
        address author;
        string content;
        uint256 timestamp;
    }

    error PostEmpty();
    error PostTooLong(uint256 length, uint256 maxLength);
    error PostNotFound(uint256 id);

    event PostCreated(
        uint256 indexed id,
        address indexed author,
        string content,
        uint256 timestamp
    );

    uint256 public totalPosts;
    mapping(uint256 => Post) private postsById;

    function createPost(string calldata content) external {
        uint256 contentLength = bytes(content).length;

        if (contentLength == 0) {
            revert PostEmpty();
        }

        if (contentLength > MAX_POST_LENGTH) {
            revert PostTooLong(contentLength, MAX_POST_LENGTH);
        }

        uint256 postId = totalPosts;
        postsById[postId] = Post({
            id: postId,
            author: msg.sender,
            content: content,
            timestamp: block.timestamp
        });

        totalPosts = postId + 1;

        emit PostCreated(postId, msg.sender, content, block.timestamp);
    }

    function getPost(uint256 id) external view returns (Post memory) {
        if (id >= totalPosts) {
            revert PostNotFound(id);
        }

        return postsById[id];
    }

    function getRecentPosts(uint256 count) external view returns (Post[] memory) {
        uint256 availablePosts = totalPosts;

        if (count > availablePosts) {
            count = availablePosts;
        }

        Post[] memory recentPosts = new Post[](count);

        for (uint256 i = 0; i < count; i++) {
            recentPosts[i] = postsById[availablePosts - i - 1];
        }

        return recentPosts;
    }
}
